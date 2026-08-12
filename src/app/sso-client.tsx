"use client";

import { useCallback, useState } from "react";
import {
  DeviceLogin,
  type SsoUiPhase,
} from "@/app/device-login";

type SessionSummary = {
  accountId?: string;
  accountName?: string;
  roleName?: string;
  awsExpiration?: string;
};

type SsoClientProps = {
  initialSession?: SessionSummary | null;
};

/**
 * Shell UI matching the provided Desktop page / account-picker layout.
 * Auth + project logic stays inside DeviceLogin — UI chrome only.
 */
export function SsoClient({ initialSession }: SsoClientProps) {
  const [phase, setPhase] = useState<SsoUiPhase>("checking");
  const onPhaseChange = useCallback((next: SsoUiPhase) => {
    setPhase(next);
  }, []);

  const authenticated =
    phase === "select-scope" || phase === "loading" || phase === "error";
  const checking = phase === "checking";

  return (
    <div className="space-y-6">
      {!checking && (
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
              AWS IAM Identity Center
            </p>
            <h1 className="text-gradient text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              {authenticated ? "Choose access" : "Sign in"}
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              {authenticated
                ? "Pick an account, role, and project. SSO session and credentials stay in IndexedDB in this browser."
                : "Authenticate with AWS SSO. Your session is stored in IndexedDB in this browser."}
            </p>
          </div>
        </header>
      )}

      <div
        className={
          authenticated
            ? "grid items-start gap-6 lg:grid-cols-2 lg:gap-8"
            : "mx-auto flex w-full max-w-lg flex-col items-center"
        }
      >
        <div
          className={
            authenticated
              ? "min-w-0 lg:sticky lg:top-8"
              : checking
                ? "flex min-h-[40vh] w-full items-center justify-center"
                : "w-full"
          }
        >
          <DeviceLogin
            initialSession={initialSession}
            onPhaseChange={onPhaseChange}
          />
        </div>

        {authenticated && (
          <div className="min-w-0">
            <section className="glass-card animate-slide-up flex min-h-[280px] flex-col items-center justify-center gap-3 border-dashed p-8 text-center">
              <p className="text-sm font-medium text-foreground">
                Ready when you are
              </p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Choose an account and role on the left, confirm the mapped
                project, then continue to open the app.
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
