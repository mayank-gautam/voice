"use client";

import { useCallback, useState } from "react";
import { CheckCircle2, Shield } from "lucide-react";
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
  const selecting = phase === "select-scope";

  return (
    <div className="space-y-6 sm:space-y-8">
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
                ? "Pick an account, role, and project, then use this account to open the app."
                : "Authenticate with AWS SSO. Your session stays in this browser."}
            </p>
          </div>
        </header>
      )}

      <div
        className={
          authenticated
            ? "grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-8"
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
            <section className="glass-card animate-slide-up flex min-h-[280px] flex-col justify-between gap-6 border-dashed p-6 sm:p-8">
              <div className="space-y-4">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Shield className="h-5 w-5" aria-hidden />
                </div>
                <div className="space-y-2">
                  <p className="text-base font-semibold text-foreground">
                    {selecting ? "Confirm and continue" : "Almost there"}
                  </p>
                  <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                    {selecting
                      ? "Review the account, role, and project on the left. Use This Account opens the app with that selection."
                      : "Finish signing in, then choose an account and role to continue."}
                  </p>
                </div>
              </div>

              <ol className="space-y-3 text-sm text-muted-foreground">
                {[
                  "Select an AWS account",
                  "Choose a role for that account",
                  "Confirm the mapped project",
                  "Use This Account to open the app",
                ].map((step, index) => (
                  <li key={step} className="flex items-start gap-2.5">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-primary/70"
                      aria-hidden
                    />
                    <span>
                      <span className="mr-1.5 text-xs font-semibold text-foreground/70">
                        {index + 1}.
                      </span>
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
