import { promises as fs } from "fs";
import path from "path";
import {
  getMappedDefaultProjectId,
  getMappedProject,
  getMappedTenantId,
  getMappingEntry,
  isTwilioMappingsFile,
  listMappedProjects,
  listMappedRolesForAccount,
  listMappedScope,
  mappedProjectHasTwilio,
  toMappedProjectScope,
  type MappedProjectPublic,
  type MappedProjectScope,
  type MappedScopeAccount,
  type TwilioMappingProject,
  type TwilioMappingsFile,
} from "@/lib/twilioMappings";
import type { TwilioEnvConfig } from "@/lib/server/twilioEnv";
import { resolveTwilioRegionEdge } from "@/lib/twilioRegions";
import bundledDefault from "@/config/twilio-mappings.json";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "twilio-mappings.json");

/**
 * Load twilio-mappings.json (source of truth for account → role → project → Twilio).
 */
export async function loadTwilioMappings(): Promise<TwilioMappingsFile> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (isTwilioMappingsFile(parsed)) {
      return parsed;
    }
    console.warn(
      "[twilio-mappings] .data/twilio-mappings.json has an unexpected shape; using empty mappings.",
    );
    return { mappings: {} };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") {
      console.warn("[twilio-mappings] failed to read file:", error);
    }
  }

  if (isTwilioMappingsFile(bundledDefault)) {
    return bundledDefault as TwilioMappingsFile;
  }

  return { mappings: {} };
}

export async function getMappedScopeCatalog(): Promise<MappedScopeAccount[]> {
  const file = await loadTwilioMappings();
  return listMappedScope(file);
}

export async function getMappedRolesForAccount(
  accountId: string,
): Promise<string[]> {
  const file = await loadTwilioMappings();
  return listMappedRolesForAccount(file, accountId);
}

export async function getMappedProjectsForRole(
  accountId: string,
  roleName: string,
): Promise<MappedProjectPublic[]> {
  const file = await loadTwilioMappings();
  return listMappedProjects(file, accountId, roleName);
}

export async function mappingHasAccountRole(
  accountId: string,
  roleName: string,
): Promise<boolean> {
  const file = await loadTwilioMappings();
  return Boolean(getMappingEntry(file, accountId, roleName));
}

export async function getDefaultMappedProjectId(
  accountId: string,
  roleName: string,
): Promise<string | null> {
  const file = await loadTwilioMappings();
  return getMappedDefaultProjectId(file, accountId, roleName);
}

export async function getTenantIdFromMappings(
  accountId: string,
  roleName: string,
  projectId: string,
): Promise<string | null> {
  const file = await loadTwilioMappings();
  return getMappedTenantId(file, accountId, roleName, projectId);
}

/**
 * Build Twilio SDK config including region + edge from the mapping entry.
 */
function toTwilioEnvConfig(project: TwilioMappingProject | null): TwilioEnvConfig | null {
  const accountSid = project?.accountSid?.trim();
  const authToken = project?.authToken?.trim();
  if (!accountSid || !authToken) return null;

  const { region, edge } = resolveTwilioRegionEdge(
    typeof project?.region === "string" ? project.region : undefined,
    typeof project?.edge === "string" ? project.edge : undefined,
  );

  return {
    accountSid,
    authToken,
    region,
    edge,
    phoneNumber:
      typeof project?.phoneNumber === "string"
        ? project.phoneNumber.trim() || undefined
        : undefined,
  };
}

export async function getTwilioConfigFromMappings(
  accountId: string,
  roleName: string,
  projectId: string,
): Promise<TwilioEnvConfig | null> {
  const file = await loadTwilioMappings();
  return toTwilioEnvConfig(getMappedProject(file, accountId, roleName, projectId));
}

export async function projectMappedHasTwilio(
  accountId: string,
  roleName: string,
  projectId: string,
): Promise<boolean> {
  const file = await loadTwilioMappings();
  return mappedProjectHasTwilio(file, accountId, roleName, projectId);
}

/* -------------------------------------------------------------------------- */
/* Project scope helpers (formerly accountHierarchy server module)            */
/* -------------------------------------------------------------------------- */

export type { MappedProjectScope };

/**
 * Projects for the authenticated AWS account + role from twilio-mappings.json.
 */
export async function listMappedProjectScopes(
  accountId: string,
  roleName: string,
): Promise<MappedProjectScope[]> {
  const mapped = await getMappedProjectsForRole(accountId, roleName);
  return mapped.map((project) => toMappedProjectScope(accountId, roleName, project));
}

/** @deprecated Prefer listMappedProjectScopes */
export async function listHierarchyProjectsForAccount(
  accountId: string,
  roleName: string,
): Promise<MappedProjectScope[]> {
  return listMappedProjectScopes(accountId, roleName);
}

export async function getMappedProjectScope(
  accountId: string,
  roleName: string,
  projectId: string,
): Promise<MappedProjectScope | null> {
  const mapped = await getMappedProjectsForRole(accountId, roleName);
  const project = mapped.find((item) => item.id === projectId.trim());
  if (!project) return null;
  return toMappedProjectScope(accountId, roleName, project);
}

/** @deprecated Prefer getMappedProjectScope */
export async function getHierarchyProject(
  accountId: string,
  roleName: string,
  projectId: string,
): Promise<MappedProjectScope | null> {
  return getMappedProjectScope(accountId, roleName, projectId);
}

export async function accountHasMappedProjects(accountId: string): Promise<boolean> {
  const file = await loadTwilioMappings();
  return Object.keys(file.mappings).some((key) => key.startsWith(`${accountId.trim()}:`));
}

/** @deprecated Prefer accountHasMappedProjects */
export async function accountHasHierarchyProjects(accountId: string): Promise<boolean> {
  return accountHasMappedProjects(accountId);
}

export async function accountRoleHasMappedProjects(
  accountId: string,
  roleName: string,
): Promise<boolean> {
  return mappingHasAccountRole(accountId, roleName);
}

export async function getDefaultProjectIdForRole(
  accountId: string | null | undefined,
  roleName?: string | null,
): Promise<string | null> {
  if (!accountId?.trim() || !roleName?.trim()) return null;
  return getDefaultMappedProjectId(accountId, roleName);
}

/** @deprecated Prefer getDefaultProjectIdForRole */
export async function getDefaultProjectIdFromHierarchy(
  accountId: string | null | undefined,
  roleName?: string | null,
): Promise<string | null> {
  return getDefaultProjectIdForRole(accountId, roleName);
}

export async function getTwilioConfigForMappedProject(
  accountId: string,
  projectId: string,
  roleName?: string | null,
): Promise<TwilioEnvConfig | null> {
  if (!roleName?.trim()) return null;
  return getTwilioConfigFromMappings(accountId, roleName, projectId);
}

/** @deprecated Prefer getTwilioConfigForMappedProject */
export async function getTwilioConfigFromHierarchy(
  accountId: string,
  projectId: string,
  roleName?: string | null,
): Promise<TwilioEnvConfig | null> {
  return getTwilioConfigForMappedProject(accountId, projectId, roleName);
}

export async function getTenantIdForMappedProject(
  accountId: string | null | undefined,
  projectId: string | null | undefined,
  roleName?: string | null,
): Promise<string | null> {
  if (!accountId?.trim() || !projectId?.trim() || !roleName?.trim()) return null;
  return getTenantIdFromMappings(accountId, roleName, projectId);
}

/** @deprecated Prefer getTenantIdForMappedProject */
export async function getTenantIdFromHierarchy(
  accountId: string | null | undefined,
  projectId: string | null | undefined,
  roleName?: string | null,
): Promise<string | null> {
  return getTenantIdForMappedProject(accountId, projectId, roleName);
}

export async function requireTwilioConfigForMappedProject(
  accountId: string,
  projectId: string,
  roleName?: string | null,
): Promise<TwilioEnvConfig> {
  const config = await getTwilioConfigForMappedProject(accountId, projectId, roleName);
  if (!config) {
    throw new Error(
      `Twilio is not configured in twilio-mappings for account ${accountId} / role ${roleName || "(missing)"} / project ${projectId}.`,
    );
  }
  return config;
}

/** @deprecated Prefer requireTwilioConfigForMappedProject */
export async function requireTwilioConfigFromHierarchy(
  accountId: string,
  projectId: string,
  roleName?: string | null,
): Promise<TwilioEnvConfig> {
  return requireTwilioConfigForMappedProject(accountId, projectId, roleName);
}

/**
 * Resolve active project for a server request from mapped projects.
 */
export async function resolveActiveMappedProjectId(
  accountId: string,
  roleName: string,
  preferredId?: string | null,
): Promise<string | null> {
  const projects = await listMappedProjectScopes(accountId, roleName);
  if (projects.length === 0) return null;

  const preferred = preferredId?.trim();
  if (preferred && projects.some((project) => project.id === preferred)) {
    return preferred;
  }

  const defaultId = await getDefaultProjectIdForRole(accountId, roleName);
  if (defaultId && projects.some((project) => project.id === defaultId)) {
    return defaultId;
  }

  return null;
}

/** @deprecated Prefer resolveActiveMappedProjectId */
export async function resolveActiveHierarchyProjectId(
  accountId: string,
  roleName: string,
  preferredId?: string | null,
): Promise<string | null> {
  return resolveActiveMappedProjectId(accountId, roleName, preferredId);
}

export async function projectHasTwilio(
  accountId: string,
  roleName: string,
  projectId: string,
): Promise<boolean> {
  return projectMappedHasTwilio(accountId, roleName, projectId);
}
