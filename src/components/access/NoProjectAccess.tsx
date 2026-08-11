"use client";

import Link from "next/link";
import { FolderKanban, LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearAllCredentials } from "@/lib/credentials-store";

type NoProjectAccessProps = {
  accountId?: string | null;
  roleName?: string | null;
};

export function NoProjectAccess({ accountId, roleName }: NoProjectAccessProps) {
  const handleLogout = async () => {
    try {
      await clearAllCredentials();
    } catch {
      /* ignore */
    }
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/sso";
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-card/80 p-8 text-center shadow-xl backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-500">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
          No Project Access
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          You are successfully authenticated, but no project has been assigned to
          your current AWS account/role.
        </p>

        {(accountId || roleName) && (
          <div className="mt-5 rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-left text-xs text-muted-foreground">
            {accountId && (
              <p>
                AWS account:{" "}
                <span className="font-mono text-foreground">{accountId}</span>
              </p>
            )}
            {roleName && (
              <p className="mt-1">
                Role: <span className="font-mono text-foreground">{roleName}</span>
              </p>
            )}
          </div>
        )}

        <p className="mt-4 text-sm text-muted-foreground">
          Create a project for this role, or contact your administrator if you
          expected existing access.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild className="gap-2">
            <Link href="/project-setup">
              <FolderKanban className="h-4 w-4" />
              Configure project
            </Link>
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => void handleLogout()}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
