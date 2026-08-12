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
 * Shell UI for SSO. Account/role picker + active credentials live in DeviceLogin.
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
    <div className="space-y-6 sm:space-y-8">
      {!checking && (
        <header className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
            AWS IAM Identity Center
          </p>
          <h1 className="text-gradient text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            {authenticated ? "Home" : "SSO device login"}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {authenticated
              ? "SSO session and AWS role credentials are stored in IndexedDB in this browser."
              : "Approve a one-time code once. Your session is saved in this browser so you can switch accounts without signing in again."}
          </p>
        </header>
      )}

      <div
        className={
          checking
            ? "flex min-h-[40vh] w-full items-center justify-center"
            : "w-full"
        }
      >
        <DeviceLogin
          initialSession={initialSession}
          onPhaseChange={onPhaseChange}
        />
      </div>
    </div>
  );
}
