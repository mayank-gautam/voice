"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { NoProjectAccess } from "@/components/access/NoProjectAccess";
import { useProjects } from "@/lib/projectConfig";
import { useGlobalLoading } from "@/lib/loading";
import { getSelectedCredentials } from "@/lib/credentials-store";

/**
 * Routes that remain available when the user is authenticated but has zero
 * projects for the current AWS account in account-hierarchy.
 */
const PROJECT_OPTIONAL_PREFIXES = ["/settings", "/sso", "/login"];

function isProjectOptionalPath(pathname: string): boolean {
  return PROJECT_OPTIONAL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

type AccessGateProps = {
  children: ReactNode;
};

/**
 * Client-side authorization gate for dashboard pages.
 * Cookie/SSO auth is enforced by proxy.ts; this gate enforces project access
 * from account-hierarchy (no manual project setup).
 *
 * Uses a local spinner only — does not start the global loader (avoids stacking
 * with RouteLoadingListener / page fetches).
 */
export function AccessGate({ children }: AccessGateProps) {
  const pathname = usePathname();
  const { projects, activeId, loading, error, refresh } = useProjects();
  const { isLoading: globalLoading } = useGlobalLoading();
  const [sessionMeta, setSessionMeta] = useState<{
    accountId?: string;
    roleName?: string;
  }>({});

  const optional = useMemo(() => isProjectOptionalPath(pathname), [pathname]);
  const hasProjects = projects.length > 0;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const selected = await getSelectedCredentials();
        if (cancelled || !selected) return;
        setSessionMeta({
          accountId: selected.accountId,
          roleName: selected.roleName,
        });
      } catch {
        /* IndexedDB unavailable — UI still works from server session */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // If URL/local active project is not in the authorized list, force a resync.
  useEffect(() => {
    if (loading || !hasProjects || !activeId) return;
    if (projects.some((project) => project.id === activeId)) return;
    void refresh();
  }, [loading, hasProjects, activeId, projects, refresh]);

  if (loading) {
    // Prefer the single GlobalLoader when a route transition already owns it.
    if (globalLoading) return null;

    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Checking project access…
          </p>
        </div>
      </div>
    );
  }

  if (error && !optional) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <h2 className="text-lg font-semibold text-foreground">Unable to verify access</h2>
          <p className="mt-2 text-sm text-destructive">{error}</p>
          <button
            type="button"
            className="mt-4 text-sm font-medium text-primary hover:underline"
            onClick={() => void refresh()}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!hasProjects && !optional) {
    return (
      <NoProjectAccess
        accountId={sessionMeta.accountId}
        roleName={sessionMeta.roleName}
      />
    );
  }

  return <>{children}</>;
}
