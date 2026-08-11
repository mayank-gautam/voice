"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cascadeSelection,
  emptyHierarchySelection,
  fetchAccountHierarchy,
  listAccounts,
  listGroupsForProject,
  listProjectsForRole,
  listRolesForAccount,
  type AccountHierarchy,
  type HierarchySelection,
} from "@/lib/accountHierarchy";

export function useAccountHierarchy() {
  const [hierarchy, setHierarchy] = useState<AccountHierarchy | null>(null);
  const [selection, setSelectionState] = useState<HierarchySelection>(emptyHierarchySelection);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await fetchAccountHierarchy();
      setHierarchy(data);
      setSelectionState((prev) => cascadeSelection(prev, {}, data));
    } catch (e) {
      setHierarchy(null);
      setError(e instanceof Error ? e.message : "Failed to load hierarchy");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setSelection = useCallback(
    (patch: Partial<HierarchySelection>) => {
      if (!hierarchy) return;
      setSelectionState((prev) => cascadeSelection(prev, patch, hierarchy));
    },
    [hierarchy],
  );

  const accounts = useMemo(
    () => (hierarchy ? listAccounts(hierarchy) : []),
    [hierarchy],
  );
  const roles = useMemo(
    () => (hierarchy ? listRolesForAccount(hierarchy, selection.accountId) : []),
    [hierarchy, selection.accountId],
  );
  const projects = useMemo(
    () =>
      hierarchy
        ? listProjectsForRole(hierarchy, selection.accountId, selection.roleId)
        : [],
    [hierarchy, selection.accountId, selection.roleId],
  );
  const groups = useMemo(
    () =>
      hierarchy
        ? listGroupsForProject(
            hierarchy,
            selection.accountId,
            selection.roleId,
            selection.projectId,
          )
        : [],
    [hierarchy, selection.accountId, selection.roleId, selection.projectId],
  );

  return {
    hierarchy,
    selection,
    setSelection,
    accounts,
    roles,
    projects,
    groups,
    loading,
    error,
    refresh,
  };
}
