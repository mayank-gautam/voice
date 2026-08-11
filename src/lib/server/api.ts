import "server-only";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getValidatedSession, type SessionData } from "@/lib/session";

export type ApiErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export type AuthenticatedSession = SessionData & {
  authenticated: true;
  accountId: string;
  roleName: string;
  expiration: string;
};

export type RequireAuthResult =
  | {
      ok: true;
      session: AuthenticatedSession;
      accountId: string;
      accountName?: string;
      roleName: string;
      expiration: string;
    }
  | {
      ok: false;
      response: NextResponse<ApiErrorBody>;
    };

/** Type guard — needed because loose TS settings break `ok` discriminant narrowing. */
export function isAuthOk(
  auth: RequireAuthResult,
): auth is Extract<RequireAuthResult, { ok: true }> {
  return auth.ok === true;
}

export function apiError(
  message: string,
  status = 400,
  code = "BAD_REQUEST",
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

export async function requireAuth(): Promise<RequireAuthResult> {
  try {
    const session = await getValidatedSession();

    if (!session.authenticated) {
      return {
        ok: false as const,
        response: apiError(
          "Authentication is required. Please sign in again.",
          401,
          "UNAUTHORIZED",
        ),
      };
    }

    const accountId = session.accountId?.trim();
    const roleName = session.roleName?.trim();
    const expiration = session.expiration?.trim();

    if (!accountId) {
      return {
        ok: false as const,
        response: apiError("No AWS account is selected.", 401, "ACCOUNT_NOT_SELECTED"),
      };
    }

    if (!/^\d{12}$/.test(accountId)) {
      return {
        ok: false as const,
        response: apiError(
          "The selected AWS account ID is invalid.",
          401,
          "INVALID_SESSION_ACCOUNT",
        ),
      };
    }

    if (!roleName) {
      return {
        ok: false as const,
        response: apiError("No AWS role is selected.", 401, "ROLE_NOT_SELECTED"),
      };
    }

    if (!expiration) {
      return {
        ok: false as const,
        response: apiError(
          "The AWS credential expiration is missing. Please sign in again.",
          401,
          "SESSION_EXPIRATION_MISSING",
        ),
      };
    }

    const expirationTime = new Date(expiration).getTime();

    if (Number.isNaN(expirationTime) || expirationTime <= Date.now()) {
      return {
        ok: false as const,
        response: apiError(
          "Your AWS session has expired. Please sign in again.",
          401,
          "SESSION_EXPIRED",
        ),
      };
    }

    return {
      ok: true as const,
      session: session as AuthenticatedSession,
      accountId,
      accountName: session.accountName?.trim() || undefined,
      roleName,
      expiration,
    };
  } catch (error) {
    console.error("Session validation error:", error);
    return {
      ok: false as const,
      response: apiError(
        "Unable to validate your session. Please sign in again.",
        401,
        "SESSION_VALIDATION_ERROR",
      ),
    };
  }
}

export function validateSelectedAccount(
  requestedAccountId: string | null | undefined,
  authenticatedAccountId: string,
): NextResponse<ApiErrorBody> | null {
  const normalizedRequestedAccountId = requestedAccountId?.trim();
  const normalizedAuthenticatedAccountId = authenticatedAccountId.trim();

  if (!normalizedRequestedAccountId) {
    return null;
  }

  if (!/^\d{12}$/.test(normalizedRequestedAccountId)) {
    return apiError("The requested AWS account ID is invalid.", 400, "INVALID_AWS_ACCOUNT_ID");
  }

  if (normalizedRequestedAccountId !== normalizedAuthenticatedAccountId) {
    return apiError(
      "The requested AWS account does not match the authenticated account.",
      403,
      "ACCOUNT_MISMATCH",
    );
  }

  return null;
}

export async function resolveProjectId(searchParams?: URLSearchParams) {
  const jar = await cookies();
  return searchParams?.get("projectId") || jar.get("active-project-id")?.value || null;
}

export type AwsCredentialHeaders = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  region?: string;
};

export function parseAwsCredentialHeaders(request: Request): AwsCredentialHeaders | null {
  const accessKeyId = request.headers.get("x-aws-access-key-id")?.trim();
  const secretAccessKey = request.headers.get("x-aws-secret-access-key")?.trim();
  const sessionToken = request.headers.get("x-aws-session-token")?.trim();
  const region = request.headers.get("x-aws-region")?.trim();

  if (!accessKeyId || !secretAccessKey || !sessionToken) {
    return null;
  }

  return { accessKeyId, secretAccessKey, sessionToken, region };
}
