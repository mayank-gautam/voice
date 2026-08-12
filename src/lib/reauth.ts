"use client";

import { clearSelectedCredentials } from "@/lib/credentials-store";
import { buildSsoHref, sanitizeReturnTo } from "@/lib/auth-return-to";

type ReauthOptions = {
  /** Path (+ search) to restore after SSO. Defaults to current location. */
  returnTo?: string | null;
  /**
   * When true, also clear the iron-session cookie (session 401 / expired cookie).
   * Leave false for AWS credential expiry so DeviceLogin can reuse account/role hints.
   */
  logoutSession?: boolean;
};

let reauthInFlight: Promise<void> | null = null;

export function isReauthInProgress(): boolean {
  return reauthInFlight != null;
}

function currentReturnTo(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

/**
 * Single-flight re-authentication: clear expired client auth, optionally
 * invalidate the cookie session, then navigate to AWS SSO once.
 * Concurrent 401s share the same promise / navigation.
 */
export async function redirectToSsoForReauth(
  options: ReauthOptions = {},
): Promise<void> {
  if (reauthInFlight) return reauthInFlight;

  reauthInFlight = (async () => {
    const returnTo =
      sanitizeReturnTo(options.returnTo) ||
      sanitizeReturnTo(currentReturnTo()) ||
      "/";

    try {
      await clearSelectedCredentials().catch(() => undefined);

      if (options.logoutSession && typeof window !== "undefined") {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        }).catch(() => undefined);
      }
    } finally {
      if (typeof window !== "undefined") {
        // Hard navigation avoids stacked React loaders and stuck client state.
        window.location.assign(buildSsoHref(returnTo));
      }
    }
  })();

  return reauthInFlight;
}

/** True when a response should trigger the shared SSO reauth flow. */
export function shouldReauthFromStatus(status: number): boolean {
  return status === 401;
}

export function shouldLogoutSessionForAuthCode(code?: string | null): boolean {
  if (!code) return true;
  return (
    code === "UNAUTHORIZED" ||
    code === "ACCOUNT_NOT_SELECTED" ||
    code === "ROLE_NOT_SELECTED" ||
    code === "SESSION_EXPIRATION_MISSING" ||
    code === "SESSION_EXPIRED" ||
    code === "INVALID_SESSION_ACCOUNT"
  );
}
