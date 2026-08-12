import { promises as fs } from "fs";
import path from "path";
import {
  getDefaultProjectIdForAccount,
  getProjectEntry,
  isAccountHierarchyFile,
  listProjectIdsForAccount,
  resolveHierarchyAccountKey,
  resolveTenantIdFromHierarchy,
  toPublicHierarchyProject,
  type AccountHierarchyFile,
  type HierarchyProjectPublic,
  type HierarchyTwilioConfig,
} from "@/lib/accountHierarchy";
import type { TwilioEnvConfig } from "@/lib/server/twilioEnv";
import { resolveTwilioRegionEdge } from "@/lib/twilioRegions";
import bundledDefault from "@/config/account-hierarchy.json";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "account-hierarchy.json");

/**
 * Load account-hierarchy.json.
 * Prefers `.data/account-hierarchy.json`. Never overwrites a present file with a
 * different schema — the updated map shape is the source of truth.
 */
export async function loadAccountHierarchy(): Promise<AccountHierarchyFile> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (isAccountHierarchyFile(parsed)) {
      return parsed;
    }
    console.warn(
      "[account-hierarchy] .data/account-hierarchy.json has an unexpected shape; using empty hierarchy.",
    );
    return {};
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") {
      console.warn("[account-hierarchy] failed to read file:", error);
    }
  }

  if (isAccountHierarchyFile(bundledDefault)) {
    return bundledDefault as AccountHierarchyFile;
  }

  return {};
}

export async function listHierarchyProjectsForAccount(
  accountId: string,
  roleName: string,
): Promise<HierarchyProjectPublic[]> {
  const hierarchy = await loadAccountHierarchy();
  if (!resolveHierarchyAccountKey(hierarchy, accountId)) return [];

  const projectIds = listProjectIdsForAccount(hierarchy, accountId);
  return projectIds.flatMap((projectId) => {
    const entry = getProjectEntry(hierarchy, accountId, projectId);
    if (!entry) return [];
    return [toPublicHierarchyProject(accountId, roleName, projectId, entry)];
  });
}

export async function getHierarchyProject(
  accountId: string,
  roleName: string,
  projectId: string,
): Promise<HierarchyProjectPublic | null> {
  const hierarchy = await loadAccountHierarchy();
  const entry = getProjectEntry(hierarchy, accountId, projectId);
  if (!entry) return null;
  return toPublicHierarchyProject(accountId, roleName, projectId.trim(), entry);
}

export async function accountHasHierarchyProjects(accountId: string): Promise<boolean> {
  const hierarchy = await loadAccountHierarchy();
  return listProjectIdsForAccount(hierarchy, accountId).length > 0;
}

export async function getDefaultProjectIdFromHierarchy(
  accountId: string | null | undefined,
): Promise<string | null> {
  const hierarchy = await loadAccountHierarchy();
  return getDefaultProjectIdForAccount(hierarchy, accountId);
}

function toTwilioEnvConfig(twilio: HierarchyTwilioConfig | undefined): TwilioEnvConfig | null {
  const accountSid = twilio?.accountSid?.trim();
  const authToken = twilio?.authToken?.trim();
  if (!accountSid || !authToken) return null;

  const { region, edge } = resolveTwilioRegionEdge(twilio?.region, twilio?.edge);

  return {
    accountSid,
    authToken,
    region,
    edge,
    phoneNumber: twilio?.phoneNumber?.trim() || undefined,
  };
}

/**
 * Resolve Twilio credentials from account-hierarchy for account + project.
 * Secrets stay server-side — never return this object to the browser.
 */
export async function getTwilioConfigFromHierarchy(
  accountId: string,
  projectId: string,
): Promise<TwilioEnvConfig | null> {
  const hierarchy = await loadAccountHierarchy();
  const entry = getProjectEntry(hierarchy, accountId, projectId);
  return toTwilioEnvConfig(entry?.twilio);
}

/**
 * Resolve CloudWatch tenantId for the selected AWS account + project.
 * Source: `.data/account-hierarchy.json` (never hardcoded).
 */
export async function getTenantIdFromHierarchy(
  accountId: string | null | undefined,
  projectId: string | null | undefined,
): Promise<string | null> {
  const hierarchy = await loadAccountHierarchy();
  return resolveTenantIdFromHierarchy(hierarchy, accountId, projectId);
}

export async function requireTwilioConfigFromHierarchy(
  accountId: string,
  projectId: string,
): Promise<TwilioEnvConfig> {
  const config = await getTwilioConfigFromHierarchy(accountId, projectId);
  if (!config) {
    throw new Error(
      `Twilio is not configured in account-hierarchy for account ${accountId} / project ${projectId}.`,
    );
  }
  return config;
}

/**
 * Resolve which project to use for a server request.
 * Prefers an explicit/cookie project id when it exists in hierarchy;
 * otherwise falls back to the configured default project.
 * Does not persist anything — IndexedDB AppSettings is the client source of truth.
 */
export async function resolveActiveHierarchyProjectId(
  accountId: string,
  roleName: string,
  preferredId?: string | null,
): Promise<string | null> {
  const projects = await listHierarchyProjectsForAccount(accountId, roleName);
  if (projects.length === 0) return null;

  const preferred = preferredId?.trim();
  if (preferred && projects.some((project) => project.id === preferred)) {
    return preferred;
  }

  const defaultId = await getDefaultProjectIdFromHierarchy(accountId);
  if (defaultId && projects.some((project) => project.id === defaultId)) {
    return defaultId;
  }

  return null;
}
