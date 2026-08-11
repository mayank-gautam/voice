import { NextRequest, NextResponse } from "next/server";
import { apiError, requireAuth, isAuthOk } from "@/lib/server/api";
import {
  getProjectById,
  projectMatchesRole,
  toPublicProject,
} from "@/lib/server/projectStore";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  const { id } = await ctx.params;
  const project = await getProjectById(id, {
    accountId: auth.accountId,
    roleName: auth.roleName,
  });
  if (!project) return apiError("Project not found", 404, "NOT_FOUND");

  if (!projectMatchesRole(project, auth.accountId, auth.roleName)) {
    return apiError("Project not found for this AWS account", 404, "NOT_FOUND");
  }

  return NextResponse.json({ project: toPublicProject(project) });
}

export async function PUT() {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  return apiError(
    "Projects are managed in account-hierarchy.json and cannot be edited here.",
    403,
    "HIERARCHY_READONLY",
  );
}

export async function DELETE() {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  return apiError(
    "Projects are managed in account-hierarchy.json and cannot be deleted here.",
    403,
    "HIERARCHY_READONLY",
  );
}
