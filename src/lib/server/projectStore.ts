import {
  getHierarchyProject,
  listHierarchyProjectsForAccount,
  resolveActiveHierarchyProjectId,
  setActiveHierarchyProjectId,
} from "@/lib/server/accountHierarchy";
import type { HierarchyProjectPublic } from "@/lib/accountHierarchy";

export interface ProjectConfig {
  id: string;
  name: string;
  environment: "development" | "staging" | "production";
  /** AWS account that owns this project (12-digit). */
  awsAccountId: string;
  /** IAM Identity Center role from the current SSO session. */
  awsRoleName: string;
  /** True when Twilio SID+token exist in account-hierarchy for this project. */
  hasTwilio?: boolean;
  aws: {
    region: string;
    cloudWatchLogGroup?: string;
    cloudWatchFilterPattern?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type ProjectPublic = ProjectConfig;

function fromHierarchy(project: HierarchyProjectPublic): ProjectConfig {
  return {
    id: project.id,
    name: project.name,
    environment: project.environment,
    awsAccountId: project.awsAccountId,
    awsRoleName: project.awsRoleName,
    hasTwilio: project.hasTwilio,
    aws: { ...project.aws },
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export function projectMatchesRole(
  project: ProjectConfig,
  accountId: string,
  _roleName: string,
): boolean {
  // Hierarchy is account-scoped (no role level in the file). Role is session context only.
  const normalizedAccountId = accountId.trim();
  return Boolean(project.awsAccountId) && project.awsAccountId === normalizedAccountId;
}

export function toPublicProject(project: ProjectConfig): ProjectPublic {
  return { ...project };
}

export async function listProjectsForRole(
  accountId: string,
  roleName: string,
): Promise<ProjectPublic[]> {
  const projects = await listHierarchyProjectsForAccount(accountId, roleName);
  return projects.map(fromHierarchy);
}

export async function getStoreMetaForRole(
  accountId: string,
  roleName: string,
  preferredId?: string | null,
): Promise<{ activeProjectId: string | null }> {
  const activeProjectId = await resolveActiveHierarchyProjectId(
    accountId,
    roleName,
    preferredId,
  );
  return { activeProjectId };
}

export async function getProjectById(
  id: string,
  scope?: { accountId: string; roleName: string },
): Promise<ProjectConfig | null> {
  if (!scope) return null;
  const project = await getHierarchyProject(scope.accountId, scope.roleName, id);
  return project ? fromHierarchy(project) : null;
}

export async function getDecryptedActiveProject(
  projectId?: string | null,
  scope?: { accountId: string; roleName: string },
): Promise<ProjectConfig | null> {
  if (!scope) return null;

  const activeId = await resolveActiveHierarchyProjectId(
    scope.accountId,
    scope.roleName,
    projectId,
  );
  if (!activeId) return null;

  const project = await getHierarchyProject(scope.accountId, scope.roleName, activeId);
  return project ? fromHierarchy(project) : null;
}

export async function setActiveProjectId(id: string): Promise<boolean> {
  const trimmed = id?.trim();
  if (!trimmed) return false;
  await setActiveHierarchyProjectId(trimmed);
  return true;
}

/** Manual create/update/delete disabled — account-hierarchy.json is the source of truth. */
export async function createProject(
  _input: Omit<ProjectConfig, "createdAt" | "updatedAt"> & {
    createdAt?: string;
    updatedAt?: string;
  },
): Promise<ProjectPublic> {
  throw new Error(
    "Projects are defined in account-hierarchy.json and cannot be created from the UI.",
  );
}

export async function updateProject(
  _id: string,
  _patch: Partial<ProjectConfig>,
): Promise<ProjectPublic | null> {
  throw new Error(
    "Projects are defined in account-hierarchy.json and cannot be edited from the UI.",
  );
}

export async function deleteProject(_id: string): Promise<boolean> {
  throw new Error(
    "Projects are defined in account-hierarchy.json and cannot be deleted from the UI.",
  );
}
