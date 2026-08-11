import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { unsealData } from "iron-session";

const SESSION_COOKIE_NAME = "aws_sso_session";

type SessionData = {
  authenticated?: boolean;
  accountId?: string;
  roleName?: string;
  expiration?: string;
};

const PUBLIC_PATHS = [
  "/login",
  "/sso",
  "/api/auth/login",
  "/api/auth/poll",
  "/api/auth/refresh",
  "/api/auth/session",
  "/api/auth/logout",
  "/api/aws",
];

async function isRequestAuthenticated(request: NextRequest): Promise<boolean> {
  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const password = process.env.SESSION_SECRET;

  if (!cookieValue || !password) {
    return false;
  }

  try {
    const session = await unsealData<SessionData>(cookieValue, { password });

    if (!session.authenticated || !session.accountId || !session.roleName) {
      return false;
    }

    const expirationTime = new Date(session.expiration || "").getTime();
    return !Number.isNaN(expirationTime) && expirationTime > Date.now();
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const isApi = pathname.startsWith("/api/");

  if (isPublic) {
    return NextResponse.next();
  }

  const isAuthed = await isRequestAuthenticated(request);

  if (!isAuthed) {
    if (isApi) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 },
      );
    }
    return NextResponse.redirect(new URL("/sso", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
