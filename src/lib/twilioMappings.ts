/**
 * twilio-mappings.json shape (ops-managed source of truth):
 *
 * Active project is NOT chosen from JSON. The user picks a project on SSO
 * (Choose Project → Use Credentials); that projectId is stored in IndexedDB
 * AppSettings and reused on later loads / dropdown changes.
 *
 * {
 *   "mappings": {
 *     "<accountId>:<roleName>": {
 *       "projects": {
 *         "<projectId>": {
 *           "accountSid": "AC...",
 *           "authToken": "...",
 *           "region": "us1",
 *           "edge": "ashburn",
 *           "tenantId": "..."
 *         }
 *       }
 *     }
 *   },
 *   "savedAt": "..."
 * }
 */

export type TwilioMappingProject = {
  accountSid?: string;
  authToken?: string;
  region?: string;
  edge?: string;
  phoneNumber?: string;
  tenantId?: string;
  tenentId?: string;
  [key: string]: unknown;
};

export type TwilioMappingEntry = {
  defaultProject?: string;
  defaultProjectId?: string;
  projects: Record<string, TwilioMappingProject>;
};

export type TwilioMappingsFile = {
  mappings: Record<string, TwilioMappingEntry>;
  savedAt?: string;
  _comment?: string;
};

export type MappedScopeAccount = {
  accountId: string;
  roles: string[];
};

export type MappedProjectPublic = {
  id: string;
  name: string;
  hasTwilio: boolean;
  hasTenantId: boolean;
};

export function mappingKey(accountId: string, roleName: string): string {
  return `${accountId.trim()}:${roleName.trim()}`;
}

export function parseMappingKey(
  key: string,
): { accountId: string; roleName: string } | null {
  const trimmed = key.trim();
  const idx = trimmed.indexOf(":");
  if (idx <= 0 || idx === trimmed.length - 1) return null;
  return {
    accountId: trimmed.slice(0, idx).trim(),
    roleName: trimmed.slice(idx + 1).trim(),
  };
}

export function isTwilioMappingsFile(value: unknown): value is TwilioMappingsFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const mappings = (value as { mappings?: unknown }).mappings;
  if (!mappings || typeof mappings !== "object" || Array.isArray(mappings)) {
    return false;
  }
  for (const [key, entry] of Object.entries(mappings as Record<string, unknown>)) {
    if (!parseMappingKey(key)) return false;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const projects = (entry as { projects?: unknown }).projects;
    if (!projects || typeof projects !== "object" || Array.isArray(projects)) {
      return false;
    }
  }
  return true;
}

function titleCaseProjectId(projectId: string): string {
  return projectId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function readTenantId(project: TwilioMappingProject | null | undefined): string | null {
  if (!project) return null;
  for (const candidate of [project.tenantId, project.tenentId]) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function hasTwilio(project: TwilioMappingProject | null | undefined): boolean {
  return Boolean(project?.accountSid?.trim() && project?.authToken?.trim());
}

export function getMappingEntry(
  file: TwilioMappingsFile,
  accountId: string | null | undefined,
  roleName: string | null | undefined,
): TwilioMappingEntry | null {
  const account = accountId?.trim();
  const role = roleName?.trim();
  if (!account || !role) return null;
  const entry = file.mappings[mappingKey(account, role)];
  if (!entry || typeof entry !== "object") return null;
  return entry;
}

/** Accounts and roles present in mappings (no secrets). */
export function listMappedScope(file: TwilioMappingsFile): MappedScopeAccount[] {
  const byAccount = new Map<string, Set<string>>();

  for (const key of Object.keys(file.mappings || {})) {
    const parsed = parseMappingKey(key);
    if (!parsed) continue;
    if (!byAccount.has(parsed.accountId)) {
      byAccount.set(parsed.accountId, new Set());
    }
    byAccount.get(parsed.accountId)!.add(parsed.roleName);
  }

  return [...byAccount.entries()]
    .map(([accountId, roles]) => ({
      accountId,
      roles: [...roles].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.accountId.localeCompare(b.accountId));
}

export function listMappedRolesForAccount(
  file: TwilioMappingsFile,
  accountId: string | null | undefined,
): string[] {
  const id = accountId?.trim();
  if (!id) return [];
  return listMappedScope(file).find((entry) => entry.accountId === id)?.roles ?? [];
}

export function listMappedProjects(
  file: TwilioMappingsFile,
  accountId: string | null | undefined,
  roleName: string | null | undefined,
): MappedProjectPublic[] {
  const entry = getMappingEntry(file, accountId, roleName);
  if (!entry?.projects) return [];

  return Object.keys(entry.projects)
    .filter((projectId) => {
      const project = entry.projects[projectId];
      return project && typeof project === "object" && !Array.isArray(project);
    })
    .map((projectId) => {
      const project = entry.projects[projectId];
      return {
        id: projectId,
        name: titleCaseProjectId(projectId),
        hasTwilio: hasTwilio(project),
        hasTenantId: Boolean(readTenantId(project)),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function getMappedProject(
  file: TwilioMappingsFile,
  accountId: string | null | undefined,
  roleName: string | null | undefined,
  projectId: string | null | undefined,
): TwilioMappingProject | null {
  const entry = getMappingEntry(file, accountId, roleName);
  const pid = projectId?.trim();
  if (!entry || !pid) return null;
  const project = entry.projects[pid];
  if (!project || typeof project !== "object" || Array.isArray(project)) return null;
  return project;
}

/**
 * @deprecated Ignored for active-project selection. Active project comes from
 * IndexedDB AppSettings (SSO Choose Project / project dropdown).
 * Returns an optional ops hint from JSON only — never invents a project id.
 */
export function getMappedDefaultProjectId(
  file: TwilioMappingsFile,
  accountId: string | null | undefined,
  roleName: string | null | undefined,
): string | null {
  const entry = getMappingEntry(file, accountId, roleName);
  if (!entry) return null;

  for (const key of ["defaultProject", "defaultProjectId"] as const) {
    const value = entry[key];
    if (typeof value === "string" && value.trim() && entry.projects[value.trim()]) {
      return value.trim();
    }
  }

  return null;
}

export function getMappedTenantId(
  file: TwilioMappingsFile,
  accountId: string | null | undefined,
  roleName: string | null | undefined,
  projectId: string | null | undefined,
): string | null {
  return readTenantId(getMappedProject(file, accountId, roleName, projectId));
}

export function mappedProjectHasTwilio(
  file: TwilioMappingsFile,
  accountId: string | null | undefined,
  roleName: string | null | undefined,
  projectId: string | null | undefined,
): boolean {
  return hasTwilio(getMappedProject(file, accountId, roleName, projectId));
}

/** Browser-safe project scope derived from twilio-mappings (no secrets). */
export type MappedProjectScope = {
  id: string;
  name: string;
  environment: "development" | "staging" | "production";
  awsAccountId: string;
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

/** @deprecated Use MappedProjectScope — kept for existing imports. */
export type HierarchyProjectPublic = MappedProjectScope;

export function toMappedProjectScope(
  accountId: string,
  roleName: string,
  project: MappedProjectPublic,
): MappedProjectScope {
  const now = new Date(0).toISOString();
  return {
    id: project.id,
    name: project.name,
    environment: "development",
    awsAccountId: accountId.trim(),
    awsRoleName: roleName.trim(),
    hasTwilio: project.hasTwilio,
    aws: {
      region: "us-east-1",
      cloudWatchLogGroup: "",
      cloudWatchFilterPattern: "",
    },
    createdAt: now,
    updatedAt: now,
  };
}

/** @deprecated Use toMappedProjectScope */
export function toPublicHierarchyProject(
  accountId: string,
  roleName: string,
  projectId: string,
  entry: { twilio?: { accountSid?: string; authToken?: string }; tenantId?: string },
): MappedProjectScope {
  return toMappedProjectScope(accountId, roleName, {
    id: projectId,
    name: titleCaseProjectId(projectId),
    hasTwilio: Boolean(entry.twilio?.accountSid?.trim() && entry.twilio?.authToken?.trim()),
    hasTenantId: Boolean(entry.tenantId?.trim()),
  });
}

