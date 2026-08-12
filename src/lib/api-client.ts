"use client";

import {
  redirectToSsoForReauth,
  shouldLogoutSessionForAuthCode,
  shouldReauthFromStatus,
} from "@/lib/reauth";

export type ApiClientError = Error & {
  code?: string;
  status?: number;
};

async function readErrorCode(res: Response): Promise<string | undefined> {
  try {
    const data = (await res.clone().json()) as {
      error?: { code?: string };
      code?: string;
    };
    return data?.error?.code || data?.code;
  } catch {
    return undefined;
  }
}

/**
 * Browser fetch wrapper for app APIs.
 * On 401: single-flight clear auth + redirect to AWS SSO (returnTo preserved).
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, {
    credentials: "include",
    ...init,
  });

  if (shouldReauthFromStatus(res.status)) {
    const code = await readErrorCode(res);
    await redirectToSsoForReauth({
      logoutSession: shouldLogoutSessionForAuthCode(code),
    });

    const err: ApiClientError = new Error(
      "Authentication required. Redirecting to AWS SSO…",
    );
    err.code = "AUTH_REQUIRED";
    err.status = 401;
    throw err;
  }

  return res;
}
