import { NextRequest, NextResponse } from "next/server";
import { apiError, requireAuth, isAuthOk } from "@/lib/server/api";
import {
  getProjectById,
  projectMatchesRole,
  setActiveProjectId,
} from "@/lib/server/projectStore";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, ctx: Ctx) {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  const { id } = await ctx.params;
  const project = await getProjectById(id);
  if (!project) return apiError("Project not found", 404, "NOT_FOUND");

  if (!projectMatchesRole(project, auth.accountId, auth.roleName)) {
    return apiError(
      "This project does not belong to the selected AWS account/role.",
      403,
      "PROJECT_SCOPE_MISMATCH",
    );
  }

  const ok = await setActiveProjectId(id);
  if (!ok) return apiError("Project not found", 404, "NOT_FOUND");

  const res = NextResponse.json({ activeProjectId: id });
  res.cookies.set("active-project-id", id, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
