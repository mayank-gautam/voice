import { NextRequest, NextResponse } from "next/server";
import { apiError, requireAuth, isAuthOk, resolveProjectId } from "@/lib/server/api";
import {
  getStoreMetaForRole,
  listProjectsForRole,
} from "@/lib/server/projectStore";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  // Cookie/query preferred id is only a hint for server-side routes.
  // The browser IndexedDB AppSettings projectId is the source of truth.
  const preferredId = await resolveProjectId(request.nextUrl.searchParams);

  const [projects, meta] = await Promise.all([
    listProjectsForRole(auth.accountId, auth.roleName),
    getStoreMetaForRole(auth.accountId, auth.roleName, preferredId),
  ]);

  return NextResponse.json({
    projects,
    /** Configured default from account-hierarchy.json (not a hardcoded id). */
    defaultProjectId: meta.defaultProjectId,
    /**
     * Server-resolved hint (cookie/query → else hierarchy default).
     * Clients should prefer IndexedDB AppSettings over this value.
     */
    activeProjectId: meta.activeProjectId,
    scope: {
      awsAccountId: auth.accountId,
      awsRoleName: auth.roleName,
    },
    source: "twilio-mappings",
  });
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
