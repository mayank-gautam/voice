import { NextRequest, NextResponse } from "next/server";
import { apiError, requireAuth, isAuthOk, resolveProjectId } from "@/lib/server/api";
import {
  getStoreMetaForRole,
  listProjectsForRole,
} from "@/lib/server/projectStore";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  const preferredId = await resolveProjectId(request.nextUrl.searchParams);

  const [projects, meta] = await Promise.all([
    listProjectsForRole(auth.accountId, auth.roleName),
    getStoreMetaForRole(auth.accountId, auth.roleName, preferredId),
  ]);

  const res = NextResponse.json({
    projects,
    activeProjectId: meta.activeProjectId,
    scope: {
      awsAccountId: auth.accountId,
      awsRoleName: auth.roleName,
    },
    source: "account-hierarchy",
  });

  if (meta.activeProjectId) {
    res.cookies.set("active-project-id", meta.activeProjectId, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return res;
}

export async function POST() {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  return apiError(
    "Projects are managed in account-hierarchy.json. They cannot be created from the app.",
    403,
    "HIERARCHY_READONLY",
  );
}
