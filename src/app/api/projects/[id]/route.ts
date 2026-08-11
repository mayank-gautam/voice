import { NextRequest, NextResponse } from "next/server";
import { apiError, requireAuth, isAuthOk } from "@/lib/server/api";
import {
  deleteProject,
  getProjectById,
  projectMatchesRole,
  toPublicProject,
  updateProject,
  type ProjectConfig,
} from "@/lib/server/projectStore";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  const { id } = await ctx.params;
  const project = await getProjectById(id);
  if (!project) return apiError("Project not found", 404, "NOT_FOUND");

  if (!projectMatchesRole(project, auth.accountId, auth.roleName)) {
    return apiError("Project not found for this AWS account/role", 404, "NOT_FOUND");
  }

  return NextResponse.json({ project: toPublicProject(project) });
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  const { id } = await ctx.params;
  const existing = await getProjectById(id);
  if (!existing) return apiError("Project not found", 404, "NOT_FOUND");

  if (!projectMatchesRole(existing, auth.accountId, auth.roleName)) {
    return apiError("Project not found for this AWS account/role", 404, "NOT_FOUND");
  }

  let body: Partial<ProjectConfig>;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body");
  }

  const project = await updateProject(id, {
    ...body,
    // Keep ownership locked to the authenticated session.
    awsAccountId: auth.accountId,
    awsRoleName: auth.roleName,
  });
  if (!project) return apiError("Project not found", 404, "NOT_FOUND");
  return NextResponse.json({ project });
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  const { id } = await ctx.params;
  const existing = await getProjectById(id);
  if (!existing) return apiError("Project not found", 404, "NOT_FOUND");

  if (!projectMatchesRole(existing, auth.accountId, auth.roleName)) {
    return apiError("Project not found for this AWS account/role", 404, "NOT_FOUND");
  }

  const ok = await deleteProject(id);
  if (!ok) return apiError("Project not found", 404, "NOT_FOUND");
  return NextResponse.json({ ok: true });
}
