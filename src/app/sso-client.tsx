"use client";

import { useCallback, useRef, useState } from "react";
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

const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-xl border border-border/80 bg-background/40 px-5 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:border-border hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Shell UI for the sign-in / home experience.
 * Auth + credential logic stays inside DeviceLogin.
 */
export function SsoClient({ initialSession }: SsoClientProps) {
  const [phase, setPhase] = useState<SsoUiPhase>("checking");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const logoutRef = useRef<() => void>(() => {});

  const onPhaseChange = useCallback((next: SsoUiPhase) => {
    setPhase(next);
  }, []);

  const onLogoutReady = useCallback((logout: () => void, loggingOut: boolean) => {
    logoutRef.current = logout;
    setIsLoggingOut((prev) => (prev === loggingOut ? prev : loggingOut));
  }, []);

  const authenticated =
    phase === "select-scope" || phase === "loading" || phase === "error";
  const checking = phase === "checking";
  const signingIn = phase === "sign-in" || phase === "waiting";

  return (
    <div
      className={
        signingIn && !checking
          ? "mx-auto w-full max-w-xl space-y-8"
          : "space-y-8"
      }
    >
      {!checking && (
        <header
          className={
            signingIn
              ? "space-y-3 text-center"
              : "flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"
          }
        >
          <div className={signingIn ? "space-y-3" : "space-y-2"}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/90">
              Voice
            </p>
            <h1
              className={
                signingIn
                  ? "text-gradient text-4xl font-semibold tracking-tight sm:text-5xl"
                  : "text-gradient text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[2.75rem]"
              }
            >
              {authenticated ? "Welcome back" : "Sign in"}
            </h1>
            <p
              className={
                signingIn
                  ? "mx-auto max-w-md text-sm leading-relaxed text-muted-foreground"
                  : "max-w-xl text-sm leading-relaxed text-muted-foreground"
              }
            >
              {authenticated
                ? "Choose where you want to work. Your access stays on this device until you sign out."
                : "Sign in once with your work account. You’ll approve a short code, then you can switch accounts anytime."}
            </p>
          </div>
          {authenticated ? (
            <div className="hidden shrink-0 sm:block">
              <button
                type="button"
                className={secondaryButtonClass}
                disabled={isLoggingOut}
                onClick={() => logoutRef.current()}
              >
                {isLoggingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          ) : null}
        </header>
      )}

      <div
        className={
          checking
            ? "flex min-h-[40vh] w-full items-center justify-center"
            : signingIn
              ? "flex w-full flex-col items-center"
              : "w-full"
        }
      >
        <DeviceLogin
          initialSession={initialSession}
          onPhaseChange={onPhaseChange}
          onLogoutReady={onLogoutReady}
        />
      </div>

      {authenticated ? (
        <div className="flex justify-center sm:hidden">
          <button
            type="button"
            className={secondaryButtonClass}
            disabled={isLoggingOut}
            onClick={() => logoutRef.current()}
          >
            {isLoggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
