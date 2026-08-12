"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { NoProjectAccess } from "@/components/access/NoProjectAccess";
import { useProjects } from "@/lib/projectConfig";
import { useGlobalLoading } from "@/lib/loading";
import { getSelectedCredentials } from "@/lib/credentials-store";
import { getActiveCredentials } from "@/lib/get-active-credentials";
import { isPublicPath } from "@/lib/auth-return-to";
import { isReauthInProgress, redirectToSsoForReauth } from "@/lib/reauth";

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
 * Cookie/SSO auth is enforced by proxy.ts; this gate validates AWS credential
 * state and project access from account-hierarchy before rendering.
 *
 * Uses a local spinner only when the global loader is idle (avoids stacking).
 */
export function AccessGate({ children }: AccessGateProps) {
  const pathname = usePathname();
  const { projects, activeId, loading, error, refresh } = useProjects();
  const { isLoading: globalLoading } = useGlobalLoading();
  const [sessionMeta, setSessionMeta] = useState<{
    accountId?: string;
    roleName?: string;
  }>({});
  const [authChecking, setAuthChecking] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  const optional = useMemo(() => isProjectOptionalPath(pathname), [pathname]);
  const hasProjects = projects.length > 0;

  // Validate AWS credentials before rendering protected content.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (isPublicPath(pathname)) {
        if (!cancelled) {
          setAuthChecking(false);
          setRedirecting(false);
        }
        return;
      }

      if (isReauthInProgress()) {
        if (!cancelled) {
          setRedirecting(true);
          setAuthChecking(false);
        }
        return;
      }

      setAuthChecking(true);
      try {
        const creds = await getActiveCredentials();
        if (cancelled) return;

        if (!creds.ok) {
          setRedirecting(true);
          await redirectToSsoForReauth({
            returnTo: `${pathname}${typeof window !== "undefined" ? window.location.search : ""}`,
            logoutSession: false,
          });
          return;
        }

        setSessionMeta({
          accountId: creds.credentials.accountId,
          roleName: creds.credentials.roleName,
        });
        setRedirecting(false);
      } catch {
        if (cancelled) return;
        try {
          const selected = await getSelectedCredentials();
          if (!cancelled && selected) {
            setSessionMeta({
              accountId: selected.accountId,
              roleName: selected.roleName,
            });
          }
        } catch {
          /* IndexedDB unavailable */
        }
      } finally {
        if (!cancelled) setAuthChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // If URL/local active project is not in the authorized list, force a resync.
  useEffect(() => {
    if (loading || !hasProjects || !activeId) return;
    if (projects.some((project) => project.id === activeId)) return;
    void refresh();
  }, [loading, hasProjects, activeId, projects, refresh]);

  // Reauth redirect in progress — prefer GlobalLoader; otherwise render nothing
  // (hard navigation to /sso is imminent).
  if (redirecting || isReauthInProgress()) {
    if (globalLoading) return null;
    return null;
  }

  if (authChecking || loading) {
    if (globalLoading) return null;

    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {authChecking ? "Validating session…" : "Checking project access…"}
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
