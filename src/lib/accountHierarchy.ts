/**
 * account-hierarchy.json shape (source of truth):
 *
 * {
 *   "<awsAccountId>": {
 *     "<projectId>": {
 *       "twilio": { "accountSid": "...", "authToken": "..." },
 *       "tenantId": "..."
 *     }
 *   }
 * }
 *
 * There is no role level in this file. AWS roles still come from SSO;
 * projects/Twilio/tenantId are resolved by matching the authenticated AWS account ID.
 */

export type HierarchyTwilioConfig = {
  accountSid?: string;
  authToken?: string;
  region?: string;
  edge?: string;
  phoneNumber?: string;
};

export type HierarchyProjectEntry = {
  twilio?: HierarchyTwilioConfig;
  /** CloudWatch log-group tenant fragment for this account/project. */
  tenantId?: string;
  [key: string]: unknown;
};

/** Raw file: accountId → projectId → config */
export type AccountHierarchyFile = Record<
  string,
  Record<string, HierarchyProjectEntry>
>;

/** Public project (safe for the browser — never includes Twilio secrets). */
export type HierarchyProjectPublic = {
  id: string;
  name: string;
  environment: "development" | "staging" | "production";
  awsAccountId: string;
  /** Session role that unlocked this account (not stored in hierarchy). */
  awsRoleName: string;
  hasTwilio: boolean;
  aws: {
    region: string;
    cloudWatchLogGroup?: string;
    cloudWatchFilterPattern?: string;
  };
  createdAt: string;
  updatedAt: string;
};

/**
 * Match a full 12-digit SSO account ID to a hierarchy key.
 * Supports exact keys and abbreviated keys (e.g. "11111" ↔ "…11111").
 */
export function resolveHierarchyAccountKey(
  hierarchy: AccountHierarchyFile,
  accountId: string | null | undefined,
): string | null {
  const id = accountId?.trim();
  if (!id || !hierarchy || typeof hierarchy !== "object") return null;

  if (Object.prototype.hasOwnProperty.call(hierarchy, id)) {
    return id;
  }

  const keys = Object.keys(hierarchy).filter((key) => {
    const entry = hierarchy[key];
    return entry && typeof entry === "object" && !Array.isArray(entry);
  });

  const suffix = keys.find(
    (key) => id === key || id.endsWith(key) || key.endsWith(id),
  );
  return suffix ?? null;
}

export function isAccountHierarchyFile(value: unknown): value is AccountHierarchyFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  // Reject the legacy { accounts: [...] } shape.
  if (Object.prototype.hasOwnProperty.call(value, "accounts")) return false;

  for (const [accountKey, projects] of Object.entries(value as Record<string, unknown>)) {
    if (!accountKey.trim()) return false;
    if (!projects || typeof projects !== "object" || Array.isArray(projects)) {
      return false;
    }
  }
  return true;
}

export function listProjectIdsForAccount(
  hierarchy: AccountHierarchyFile,
  accountId: string | null | undefined,
): string[] {
  const key = resolveHierarchyAccountKey(hierarchy, accountId);
  if (!key) return [];
  return Object.keys(hierarchy[key] ?? {}).filter((projectId) => {
    const entry = hierarchy[key][projectId];
    return entry && typeof entry === "object" && !Array.isArray(entry);
  });
}

export function getProjectEntry(
  hierarchy: AccountHierarchyFile,
  accountId: string | null | undefined,
  projectId: string | null | undefined,
): HierarchyProjectEntry | null {
  const key = resolveHierarchyAccountKey(hierarchy, accountId);
  const pid = projectId?.trim();
  if (!key || !pid) return null;
  const entry = hierarchy[key]?.[pid];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  return entry;
}

/**
 * Read tenantId from a hierarchy project entry.
 * Accepts canonical `tenantId` and legacy misspelling `tenentId`.
 */
export function readHierarchyTenantId(
  entry: HierarchyProjectEntry | null | undefined,
): string | null {
  if (!entry) return null;
  const candidates = [entry.tenantId, entry.tenentId];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/**
 * Resolve tenantId for the selected AWS account + project from hierarchy data.
 */
export function resolveTenantIdFromHierarchy(
  hierarchy: AccountHierarchyFile,
  accountId: string | null | undefined,
  projectId: string | null | undefined,
): string | null {
  return readHierarchyTenantId(getProjectEntry(hierarchy, accountId, projectId));
}

function titleCaseProjectId(projectId: string): string {
  return projectId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function toPublicHierarchyProject(
  accountId: string,
  roleName: string,
  projectId: string,
  entry: HierarchyProjectEntry,
): HierarchyProjectPublic {
  const twilio = entry.twilio;
  const hasTwilio = Boolean(twilio?.accountSid?.trim() && twilio?.authToken?.trim());
  const now = new Date(0).toISOString();

  return {
    id: projectId,
    name: titleCaseProjectId(projectId),
    environment: "development",
    awsAccountId: accountId.trim(),
    awsRoleName: roleName.trim(),
    hasTwilio,
    aws: {
      region: "us-east-1",
      cloudWatchLogGroup: "",
      cloudWatchFilterPattern: "",
    },
    createdAt: now,
    updatedAt: now,
  };
}
