import { NextRequest, NextResponse } from "next/server";
import { resolveCloudWatchInsightsFilter } from "@/lib/cloudWatchInsightsQuery";
import { apiError, requireAuth, isAuthOk } from "@/lib/server/api";
import {
  createProject,
  getStoreMetaForRole,
  listProjectsForRole,
  type ProjectConfig,
} from "@/lib/server/projectStore";
import { normalizeLogGroupPatterns } from "@/lib/cloudWatchLogGroups";

export async function GET() {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  const [projects, meta] = await Promise.all([
    listProjectsForRole(auth.accountId, auth.roleName),
    getStoreMetaForRole(auth.accountId, auth.roleName),
  ]);

  return NextResponse.json({
    projects,
    activeProjectId: meta.activeProjectId,
    scope: {
      awsAccountId: auth.accountId,
      awsRoleName: auth.roleName,
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  let body: Partial<ProjectConfig>;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body");
  }

  if (!body.name?.trim()) return apiError("Project name is required");

  const id = body.id?.trim() || `prj_${Math.random().toString(36).slice(2, 10)}`;

  try {
    const project = await createProject({
      id,
      name: body.name.trim(),
      environment: body.environment ?? "development",
      // Always bind to the authenticated account/role — never trust client spoofing.
      awsAccountId: auth.accountId,
      awsRoleName: auth.roleName,
      aws: {
        region: body.aws?.region || "us-east-1",
        cloudWatchLogGroup: normalizeLogGroupPatterns(body.aws?.cloudWatchLogGroup),
        cloudWatchFilterPattern: resolveCloudWatchInsightsFilter(
          body.aws?.cloudWatchFilterPattern,
        ),
      },
    });

    const res = NextResponse.json({ project }, { status: 201 });
    res.cookies.set("active-project-id", project.id, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Unable to create project",
      400,
      "PROJECT_CREATE_FAILED",
    );
  }
}
