import "server-only";

import {
  getIronSession,
  type IronSession,
  type SessionOptions,
} from "iron-session";

import { cookies } from "next/headers";

export type SessionData = {
  authenticated?: boolean;
  accountId?: string;
  accountName?: string;
  roleName?: string;
  expiration?: string;
  authenticatedAt?: string;
};

const SESSION_COOKIE_NAME = "aws_sso_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function getSessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;

  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }

  return {
    password,
    cookieName: SESSION_COOKIE_NAME,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    },
  };
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, getSessionOptions());
}

export function isSessionExpired(expiration?: string, bufferSeconds = 60): boolean {
  if (!expiration?.trim()) {
    return true;
  }

  const expirationTime = new Date(expiration).getTime();

  if (Number.isNaN(expirationTime)) {
    return true;
  }

  const normalizedBuffer = Math.max(0, bufferSeconds);
  return expirationTime <= Date.now() + normalizedBuffer * 1000;
}

export async function createAuthenticatedSession(data: {
  accountId: string;
  accountName?: string;
  roleName: string;
  expiration: string;
}): Promise<IronSession<SessionData>> {
  const accountId = data.accountId?.trim();
  const accountName = data.accountName?.trim() || undefined;
  const roleName = data.roleName?.trim();
  const expiration = data.expiration?.trim();

  if (!accountId) {
    throw new Error("AWS account ID is required.");
  }

  if (!/^\d{12}$/.test(accountId)) {
    throw new Error("AWS account ID must contain exactly 12 digits.");
  }

  if (!roleName) {
    throw new Error("AWS role name is required.");
  }

  if (!expiration) {
    throw new Error("AWS credential expiration is required.");
  }

  if (isSessionExpired(expiration, 0)) {
    throw new Error("Cannot create a session using expired AWS credentials.");
  }

  const normalizedExpiration = new Date(expiration).toISOString();
  const session = await getSession();

  session.authenticated = true;
  session.accountId = accountId;
  session.accountName = accountName;
  session.roleName = roleName;
  session.expiration = normalizedExpiration;
  session.authenticatedAt = new Date().toISOString();

  await session.save();
  return session;
}

export async function getValidatedSession(): Promise<IronSession<SessionData>> {
  const session = await getSession();

  if (!session.authenticated) {
    return session;
  }

  const accountId = session.accountId?.trim();
  const roleName = session.roleName?.trim();
  const expiration = session.expiration?.trim();

  const invalidSession =
    !accountId ||
    !/^\d{12}$/.test(accountId) ||
    !roleName ||
    !expiration ||
    isSessionExpired(expiration);

  if (invalidSession) {
    await clearAuthenticatedSession(session);
  }

  return session;
}

async function clearAuthenticatedSession(session: IronSession<SessionData>): Promise<void> {
  session.authenticated = false;
  session.accountId = undefined;
  session.accountName = undefined;
  session.roleName = undefined;
  session.expiration = undefined;
  session.authenticatedAt = undefined;
  await session.save();
}

export async function clearAuthenticatedSessionData(): Promise<void> {
  const session = await getSession();
  await clearAuthenticatedSession(session);
}

export async function destroySession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}
