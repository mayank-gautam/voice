import { promises as fs } from "fs";
import path from "path";
import { normalizeLogGroupPatterns } from "@/lib/cloudWatchLogGroups";
import { resolveCloudWatchInsightsFilter } from "@/lib/cloudWatchInsightsQuery";

export interface ProjectConfig {
  id: string;
  name: string;
  environment: "development" | "staging" | "production";
  /** AWS account that owns this project (12-digit). */
  awsAccountId: string;
  /** IAM Identity Center role that owns this project. */
  awsRoleName: string;
  aws: {
    region: string;
    cloudWatchLogGroup?: string;
    cloudWatchFilterPattern?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type ProjectPublic = ProjectConfig;

interface StoreFile {
  projects: ProjectConfig[];
  activeProjectId: string | null;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "projects.json");

function normalizeOwnerId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeProject(project: ProjectConfig): ProjectConfig {
  return {
    ...project,
    awsAccountId: normalizeOwnerId(project.awsAccountId),
    awsRoleName: normalizeOwnerId(project.awsRoleName),
    aws: {
      region: project.aws?.region || "us-east-1",
      cloudWatchLogGroup: normalizeLogGroupPatterns(project.aws?.cloudWatchLogGroup),
      cloudWatchFilterPattern: resolveCloudWatchInsightsFilter(
        project.aws?.cloudWatchFilterPattern,
      ),
    },
  };
}

export function projectMatchesRole(
  project: ProjectConfig,
  accountId: string,
  roleName: string,
): boolean {
  const normalizedAccountId = accountId.trim();
  const normalizedRoleName = roleName.trim();
  return (
    Boolean(project.awsAccountId) &&
    Boolean(project.awsRoleName) &&
    project.awsAccountId === normalizedAccountId &&
    project.awsRoleName === normalizedRoleName
  );
}

/** Migrate legacy projects that stored Twilio/AWS secrets in the file. */
function migrateLegacyProject(raw: Record<string, unknown>): ProjectConfig {
  const aws = (raw.aws as Record<string, unknown> | undefined) ?? {};

  return normalizeProject({
    id: String(raw.id ?? `prj_${Math.random().toString(36).slice(2, 10)}`),
    name: String(raw.name ?? "Untitled project"),
    environment:
      raw.environment === "staging" || raw.environment === "production"
        ? raw.environment
        : "development",
    awsAccountId: normalizeOwnerId(raw.awsAccountId),
    awsRoleName: normalizeOwnerId(raw.awsRoleName),
    aws: {
      region: typeof aws.region === "string" ? aws.region : "us-east-1",
      cloudWatchLogGroup:
        typeof aws.cloudWatchLogGroup === "string" ? aws.cloudWatchLogGroup : "",
      cloudWatchFilterPattern:
        typeof aws.cloudWatchFilterPattern === "string"
          ? aws.cloudWatchFilterPattern
          : undefined,
    },
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  });
}

async function ensureStore(): Promise<StoreFile> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as StoreFile;
    return {
      projects: (parsed.projects ?? []).map((p) =>
        migrateLegacyProject(p as unknown as Record<string, unknown>),
      ),
      activeProjectId: parsed.activeProjectId ?? null,
    };
  } catch {
    return { projects: [], activeProjectId: null };
  }
}

async function writeStore(store: StoreFile): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export function toPublicProject(project: ProjectConfig): ProjectPublic {
  return normalizeProject(project);
}

export async function listProjects(): Promise<ProjectPublic[]> {
  const store = await ensureStore();
  return store.projects.map(toPublicProject);
}

export async function listProjectsForRole(
  accountId: string,
  roleName: string,
): Promise<ProjectPublic[]> {
  const projects = await listProjects();
  return projects.filter((project) =>
    projectMatchesRole(project, accountId, roleName),
  );
}

export async function getStoreMeta(): Promise<{ activeProjectId: string | null }> {
  const store = await ensureStore();
  return { activeProjectId: store.activeProjectId ?? store.projects[0]?.id ?? null };
}

export async function getStoreMetaForRole(
  accountId: string,
  roleName: string,
): Promise<{ activeProjectId: string | null }> {
  const store = await ensureStore();
  const scoped = store.projects.filter((project) =>
    projectMatchesRole(project, accountId, roleName),
  );

  if (scoped.length === 0) {
    return { activeProjectId: null };
  }

  const activeStillValid =
    store.activeProjectId &&
    scoped.some((project) => project.id === store.activeProjectId);

  const activeProjectId = activeStillValid
    ? store.activeProjectId
    : scoped[0]?.id ?? null;

  if (activeProjectId && store.activeProjectId !== activeProjectId) {
    store.activeProjectId = activeProjectId;
    await writeStore(store);
  }

  return { activeProjectId };
}

export async function getProjectById(id: string): Promise<ProjectConfig | null> {
  const store = await ensureStore();
  const project = store.projects.find((p) => p.id === id);
  return project ? normalizeProject(project) : null;
}

export async function getActiveProject(): Promise<ProjectConfig | null> {
  const store = await ensureStore();
  const id = store.activeProjectId ?? store.projects[0]?.id;
  if (!id) return null;
  const project = store.projects.find((p) => p.id === id);
  return project ? normalizeProject(project) : null;
}

export async function getDecryptedActiveProject(
  projectId?: string | null,
  scope?: { accountId: string; roleName: string },
): Promise<ProjectConfig | null> {
  const candidate = projectId
    ? await getProjectById(projectId)
    : await getActiveProject();

  if (!scope) {
    return candidate;
  }

  if (candidate && projectMatchesRole(candidate, scope.accountId, scope.roleName)) {
    return candidate;
  }

  const scoped = await listProjectsForRole(scope.accountId, scope.roleName);
  return scoped[0] ?? null;
}

export async function createProject(
  input: Omit<ProjectConfig, "createdAt" | "updatedAt"> & {
    createdAt?: string;
    updatedAt?: string;
  },
): Promise<ProjectPublic> {
  const awsAccountId = normalizeOwnerId(input.awsAccountId);
  const awsRoleName = normalizeOwnerId(input.awsRoleName);

  if (!awsAccountId || !/^\d{12}$/.test(awsAccountId)) {
    throw new Error("Project awsAccountId must be a 12-digit AWS account ID.");
  }

  if (!awsRoleName) {
    throw new Error("Project awsRoleName is required.");
  }

  const store = await ensureStore();
  const now = new Date().toISOString();
  const project = normalizeProject({
    ...input,
    awsAccountId,
    awsRoleName,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  });
  store.projects.push(project);
  if (!store.activeProjectId) store.activeProjectId = project.id;
  await writeStore(store);
  return toPublicProject(project);
}

export async function updateProject(
  id: string,
  patch: Partial<ProjectConfig>,
): Promise<ProjectPublic | null> {
  const store = await ensureStore();
  const idx = store.projects.findIndex((p) => p.id === id);
  if (idx < 0) return null;

  const existing = normalizeProject(store.projects[idx]);
  const updated = normalizeProject({
    ...existing,
    ...patch,
    id,
    awsAccountId:
      patch.awsAccountId !== undefined
        ? normalizeOwnerId(patch.awsAccountId)
        : existing.awsAccountId,
    awsRoleName:
      patch.awsRoleName !== undefined
        ? normalizeOwnerId(patch.awsRoleName)
        : existing.awsRoleName,
    aws: {
      region: patch.aws?.region ?? existing.aws.region,
      cloudWatchLogGroup:
        patch.aws?.cloudWatchLogGroup ?? existing.aws.cloudWatchLogGroup ?? "",
      cloudWatchFilterPattern:
        patch.aws?.cloudWatchFilterPattern ?? existing.aws.cloudWatchFilterPattern,
    },
    updatedAt: new Date().toISOString(),
  });

  store.projects[idx] = updated;
  await writeStore(store);
  return toPublicProject(updated);
}

export async function deleteProject(id: string): Promise<boolean> {
  const store = await ensureStore();
  const before = store.projects.length;
  store.projects = store.projects.filter((p) => p.id !== id);
  if (store.projects.length === before) return false;
  if (store.activeProjectId === id) {
    store.activeProjectId = store.projects[0]?.id ?? null;
  }
  await writeStore(store);
  return true;
}

export async function setActiveProjectId(id: string): Promise<boolean> {
  const store = await ensureStore();
  if (!store.projects.some((p) => p.id === id)) return false;
  store.activeProjectId = id;
  await writeStore(store);
  return true;
}
