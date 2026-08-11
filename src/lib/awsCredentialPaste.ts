/**
 * Parse pasted AWS SSO / CLI temporary credentials into fields this app stores.
 * Supports common formats from:
 * - `aws configure export-credentials --format env`
 * - `aws configure export-credentials --format json` / process output
 * - IAM Identity Center portal "Get credentials" copy blocks
 * - `.env`-style KEY=value lines
 */

export type ParsedAwsCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  region?: string;
  expiration?: string;
};

function unquote(value: string): string {
  const v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

function pick(
  map: Record<string, string>,
  keys: string[]
): string | undefined {
  for (const k of keys) {
    const hit = map[k] ?? map[k.toLowerCase()] ?? map[k.toUpperCase()];
    if (hit?.trim()) return hit.trim();
  }
  return undefined;
}

function fromFlatMap(map: Record<string, string>): ParsedAwsCredentials | null {
  const accessKeyId = pick(map, [
    "AWS_ACCESS_KEY_ID",
    "aws_access_key_id",
    "AccessKeyId",
    "accessKeyId",
    "access_key_id",
  ]);
  const secretAccessKey = pick(map, [
    "AWS_SECRET_ACCESS_KEY",
    "aws_secret_access_key",
    "SecretAccessKey",
    "secretAccessKey",
    "secret_access_key",
  ]);
  const sessionToken =
    pick(map, [
      "AWS_SESSION_TOKEN",
      "aws_session_token",
      "SessionToken",
      "sessionToken",
      "session_token",
    ]) || "";
  const region = pick(map, ["AWS_REGION", "AWS_DEFAULT_REGION", "aws_region", "region"]);
  const expiration = pick(map, [
    "AWS_CREDENTIAL_EXPIRATION",
    "Expiration",
    "expiration",
    "expiresAt",
  ]);

  if (!accessKeyId || !secretAccessKey) return null;
  return {
    accessKeyId,
    secretAccessKey,
    sessionToken,
    region,
    expiration,
  };
}

function tryParseJson(raw: string): ParsedAwsCredentials | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;

    // Nested roleCredentials from `aws sso get-role-credentials`
    const nested =
      obj.roleCredentials && typeof obj.roleCredentials === "object"
        ? (obj.roleCredentials as Record<string, unknown>)
        : obj;

    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(nested)) {
      if (typeof v === "string" || typeof v === "number") map[k] = String(v);
    }
    return fromFlatMap(map);
  } catch {
    return null;
  }
}

function tryParseEnvLines(raw: string): ParsedAwsCredentials | null {
  const map: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // export AWS_ACCESS_KEY_ID=...  OR  set AWS_ACCESS_KEY_ID=...
    const cleaned = trimmed
      .replace(/^export\s+/i, "")
      .replace(/^set\s+/i, "")
      .replace(/^\$env:/i, "");

    // KEY=value  or  KEY: value (portal style)
    const eq = cleaned.match(/^([A-Za-z0-9_]+)\s*[=:]\s*(.+)$/);
    if (eq) {
      map[eq[1]] = unquote(eq[2]);
      continue;
    }
  }
  return fromFlatMap(map);
}

/** True when key looks like temporary STS/SSO (ASIA…) vs long-term IAM (AKIA…). */
export function isTemporaryAccessKeyId(accessKeyId: string): boolean {
  return /^ASIA/i.test(accessKeyId.trim());
}

/**
 * Parse a pasted credential blob. Returns null if access key + secret cannot be found.
 */
export function parseAwsCredentialPaste(raw: string): ParsedAwsCredentials | null {
  const text = raw?.trim();
  if (!text) return null;

  if (text.startsWith("{")) {
    const fromJson = tryParseJson(text);
    if (fromJson) return fromJson;
  }

  return tryParseEnvLines(text) ?? tryParseJson(text);
}
