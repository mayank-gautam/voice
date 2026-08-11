import { NextResponse } from "next/server";
import { requireAuth, isAuthOk, apiError } from "@/lib/server/api";
import { listHierarchyProjectsForAccount } from "@/lib/server/accountHierarchy";

/**
 * Public (non-secret) view of account-hierarchy for the authenticated AWS account.
 * Never returns Twilio auth tokens.
 */
export async function GET() {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  try {
    const projects = await listHierarchyProjectsForAccount(
      auth.accountId,
      auth.roleName,
    );

    return NextResponse.json({
      accountId: auth.accountId,
      roleName: auth.roleName,
      projects: projects.map((project) => ({
        projectId: project.id,
        projectName: project.name,
        hasTwilio: project.hasTwilio,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load account hierarchy";
    return apiError(message, 500, "HIERARCHY_LOAD_FAILED");
  }
}
