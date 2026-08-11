"use client";

import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAccountHierarchy } from "@/lib/useAccountHierarchy";

export type HierarchyCascadeSelection = {
  accountId: string | null;
  accountName: string | null;
  roleId: string | null;
  roleName: string | null;
  projectId: string | null;
  projectName: string | null;
  groups: string[];
  groupId: string | null;
};

type AccountHierarchyCascadeProps = {
  /** When cascade changes, notify parent with resolved names/ids + groups. */
  onSelectionChange?: (payload: HierarchyCascadeSelection) => void;
  showGroupSelect?: boolean;
};

/**
 * Cascading selectors driven by account-hierarchy JSON (via API).
 * Account → Role → Project → Twilio Groups. No hardcoded option labels.
 */
export function AccountHierarchyCascade({
  onSelectionChange,
  showGroupSelect = true,
}: AccountHierarchyCascadeProps) {
  const {
    selection,
    setSelection,
    accounts,
    roles,
    projects,
    groups,
    loading,
    error,
  } = useAccountHierarchy();

  const account = accounts.find((a) => a.accountId === selection.accountId) ?? null;
  const role = roles.find((r) => r.roleId === selection.roleId) ?? null;
  const project = projects.find((p) => p.projectId === selection.projectId) ?? null;

  useEffect(() => {
    onSelectionChange?.({
      accountId: selection.accountId,
      accountName: account?.accountName ?? null,
      roleId: selection.roleId,
      roleName: role?.roleName ?? null,
      projectId: selection.projectId,
      projectName: project?.projectName ?? null,
      groups,
      groupId: selection.groupId,
    });
  }, [
    onSelectionChange,
    selection.accountId,
    selection.roleId,
    selection.projectId,
    selection.groupId,
    account?.accountName,
    role?.roleName,
    project?.projectName,
    groups,
  ]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading account hierarchy…</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (accounts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No accounts configured in the hierarchy file.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>AWS account</Label>
          <Select
            value={selection.accountId ?? undefined}
            onValueChange={(accountId) => setSelection({ accountId })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.accountId} value={a.accountId}>
                  {a.accountName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {account && (
            <p className="text-[11px] font-mono text-muted-foreground">{account.accountId}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>AWS role</Label>
          <Select
            value={selection.roleId ?? undefined}
            onValueChange={(roleId) => setSelection({ roleId })}
            disabled={!selection.accountId || roles.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={selection.accountId ? "Select role" : "Select account first"}
              />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.roleId} value={r.roleId}>
                  {r.roleName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Project</Label>
          <Select
            value={selection.projectId ?? undefined}
            onValueChange={(projectId) => setSelection({ projectId })}
            disabled={!selection.roleId || projects.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={selection.roleId ? "Select project" : "Select role first"}
              />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.projectId} value={p.projectId}>
                  {p.projectName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showGroupSelect && (
          <div className="space-y-2">
            <Label>Twilio group</Label>
            <Select
              value={selection.groupId ?? undefined}
              onValueChange={(groupId) => setSelection({ groupId })}
              disabled={!selection.projectId || groups.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    selection.projectId ? "Select group" : "Select project first"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {groups.map((groupId) => (
                  <SelectItem key={groupId} value={groupId}>
                    {groupId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {selection.projectId && groups.length > 0 && (
        <div className="space-y-2">
          <Label className="text-muted-foreground">Configured Twilio groups</Label>
          <div className="flex flex-wrap gap-1.5">
            {groups.map((groupId) => (
              <Badge
                key={groupId}
                variant={groupId === selection.groupId ? "default" : "outline"}
                className="font-mono text-[10px]"
              >
                {groupId}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
