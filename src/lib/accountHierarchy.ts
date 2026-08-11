/**
 * Account → Role → Project → Twilio Groups hierarchy.
 *
 * Today this is loaded from the dummy JSON config (dev/testing).
 * Later the same shapes can be filled from real AWS / Twilio APIs
 * without changing cascading UI components.
 */

export type HierarchyProject = {
  projectId: string;
  projectName: string;
  /** Dummy Twilio group IDs for this project (no credentials). */
  groups: string[];
};

export type HierarchyRole = {
  roleId: string;
  roleName: string;
  projects: HierarchyProject[];
};

export type HierarchyAccount = {
  accountId: string;
  accountName: string;
  roles: HierarchyRole[];
};

export type AccountHierarchy = {
  accounts: HierarchyAccount[];
};

export type HierarchySelection = {
  accountId: string | null;
  roleId: string | null;
  projectId: string | null;
  groupId: string | null;
};

export const emptyHierarchySelection = (): HierarchySelection => ({
  accountId: null,
  roleId: null,
  projectId: null,
  groupId: null,
});

export function listAccounts(hierarchy: AccountHierarchy): HierarchyAccount[] {
  return hierarchy.accounts ?? [];
}

export function findAccount(
  hierarchy: AccountHierarchy,
  accountId: string | null | undefined,
): HierarchyAccount | null {
  if (!accountId) return null;
  return hierarchy.accounts.find((a) => a.accountId === accountId) ?? null;
}

export function listRolesForAccount(
  hierarchy: AccountHierarchy,
  accountId: string | null | undefined,
): HierarchyRole[] {
  return findAccount(hierarchy, accountId)?.roles ?? [];
}

export function findRole(
  hierarchy: AccountHierarchy,
  accountId: string | null | undefined,
  roleId: string | null | undefined,
): HierarchyRole | null {
  if (!roleId) return null;
  return listRolesForAccount(hierarchy, accountId).find((r) => r.roleId === roleId) ?? null;
}

export function listProjectsForRole(
  hierarchy: AccountHierarchy,
  accountId: string | null | undefined,
  roleId: string | null | undefined,
): HierarchyProject[] {
  return findRole(hierarchy, accountId, roleId)?.projects ?? [];
}

export function findProject(
  hierarchy: AccountHierarchy,
  accountId: string | null | undefined,
  roleId: string | null | undefined,
  projectId: string | null | undefined,
): HierarchyProject | null {
  if (!projectId) return null;
  return (
    listProjectsForRole(hierarchy, accountId, roleId).find((p) => p.projectId === projectId) ??
    null
  );
}

export function listGroupsForProject(
  hierarchy: AccountHierarchy,
  accountId: string | null | undefined,
  roleId: string | null | undefined,
  projectId: string | null | undefined,
): string[] {
  return findProject(hierarchy, accountId, roleId, projectId)?.groups ?? [];
}

/**
 * When account changes, clear role/project/group.
 * When role changes, clear project/group.
 * When project changes, clear group (and keep only valid group if still present).
 */
export function cascadeSelection(
  previous: HierarchySelection,
  patch: Partial<HierarchySelection>,
  hierarchy: AccountHierarchy,
): HierarchySelection {
  let next: HierarchySelection = { ...previous, ...patch };

  if (patch.accountId !== undefined && patch.accountId !== previous.accountId) {
    next = { accountId: patch.accountId, roleId: null, projectId: null, groupId: null };
  } else if (patch.roleId !== undefined && patch.roleId !== previous.roleId) {
    next = {
      accountId: next.accountId,
      roleId: patch.roleId,
      projectId: null,
      groupId: null,
    };
  } else if (patch.projectId !== undefined && patch.projectId !== previous.projectId) {
    next = {
      accountId: next.accountId,
      roleId: next.roleId,
      projectId: patch.projectId,
      groupId: null,
    };
  }

  // Drop invalid selections if hierarchy changed under us.
  const roles = listRolesForAccount(hierarchy, next.accountId);
  if (next.roleId && !roles.some((r) => r.roleId === next.roleId)) {
    next = { ...next, roleId: null, projectId: null, groupId: null };
  }
  const projects = listProjectsForRole(hierarchy, next.accountId, next.roleId);
  if (next.projectId && !projects.some((p) => p.projectId === next.projectId)) {
    next = { ...next, projectId: null, groupId: null };
  }
  const groups = listGroupsForProject(
    hierarchy,
    next.accountId,
    next.roleId,
    next.projectId,
  );
  if (next.groupId && !groups.includes(next.groupId)) {
    next = { ...next, groupId: null };
  }

  return next;
}

export async function fetchAccountHierarchy(): Promise<AccountHierarchy> {
  const res = await fetch("/api/account-hierarchy", { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: { message?: string } })?.error?.message ||
        `Failed to load account hierarchy (${res.status})`,
    );
  }
  return data as AccountHierarchy;
}
