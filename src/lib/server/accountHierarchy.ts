import { promises as fs } from "fs";
import path from "path";
import {
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

const ACTIVE_META_PATH = path.join(DATA_DIR, "active-project.json");

type ActiveMeta = {
  activeProjectId: string | null;
};

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
  const key = resolveHierarchyAccountKey(hierarchy, accountId);
  if (!key) return [];

  const projectIds = listProjectIdsForAccount(hierarchy, accountId);
  return projectIds.map((projectId) =>
    toPublicHierarchyProject(accountId, roleName, projectId, hierarchy[key][projectId]),
  );
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

async function readActiveMeta(): Promise<ActiveMeta> {
  try {
    const raw = await fs.readFile(ACTIVE_META_PATH, "utf8");
    const parsed = JSON.parse(raw) as ActiveMeta;
    return { activeProjectId: parsed.activeProjectId ?? null };
  } catch {
    return { activeProjectId: null };
  }
}

async function writeActiveMeta(meta: ActiveMeta): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(ACTIVE_META_PATH, JSON.stringify(meta, null, 2), "utf8");
}

/**
 * Pick the active project for this account: prefer persisted/cookie id if still
 * authorized; otherwise auto-select the sole/first hierarchy project.
 */
export async function resolveActiveHierarchyProjectId(
  accountId: string,
  roleName: string,
  preferredId?: string | null,
): Promise<string | null> {
  const projects = await listHierarchyProjectsForAccount(accountId, roleName);
  if (projects.length === 0) return null;

  const meta = await readActiveMeta();
  const candidates = [preferredId, meta.activeProjectId].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (projects.some((project) => project.id === candidate)) {
      if (meta.activeProjectId !== candidate) {
        await writeActiveMeta({ activeProjectId: candidate });
      }
      return candidate;
    }
  }

  const autoId = projects[0].id;
  await writeActiveMeta({ activeProjectId: autoId });
  return autoId;
}

export async function setActiveHierarchyProjectId(projectId: string): Promise<void> {
  await writeActiveMeta({ activeProjectId: projectId.trim() });
}
