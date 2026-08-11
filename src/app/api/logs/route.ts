import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  parseAwsCredentialHeaders,
  requireAuth,
  resolveProjectId,
  validateSelectedAccount,
  isAuthOk,
} from "@/lib/server/api";
import { getDecryptedActiveProject } from "@/lib/server/projectStore";
import {
  ALL_LOGS_LIMIT,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  fetchLogs,
} from "@/lib/server/cloudwatch";

/**
 * GET /api/logs
 * Fetch CloudWatch logs for the current user's active project (tenant-scoped).
 * Optional `callId` query filters to a single Call SID (same as /api/calls/[id]/logs).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  const accountMismatch = validateSelectedAccount(
    request.headers.get("x-selected-aws-account-id"),
    auth.accountId,
  );
  if (accountMismatch) return accountMismatch;

  const awsCredentials = parseAwsCredentialHeaders(request);
  if (!awsCredentials) {
    return apiError(
      "AWS credentials are required. Sign in with AWS SSO and retry.",
      401,
      "AWS_CREDENTIALS_REQUIRED",
    );
  }

  const projectId = await resolveProjectId(request.nextUrl.searchParams);
  const project = await getDecryptedActiveProject(projectId, {
    accountId: auth.accountId,
    roleName: auth.roleName,
  });
  if (!project) return apiError("No project configured", 400, "NO_PROJECT");

  const sp = request.nextUrl.searchParams;
  const callId = sp.get("callId")?.trim() || null;
  const start = sp.get("start");
  const end = sp.get("end");
  const offsetRaw = sp.get("offset");
  const cursorRaw = sp.get("cursor");
  const limitRaw = sp.get("limit");
  const loadAll = sp.get("all") === "1" || sp.get("all") === "true";

  const limit = loadAll
    ? ALL_LOGS_LIMIT
    : limitRaw
      ? Math.min(Math.max(Number(limitRaw) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
  const offset = loadAll
    ? 0
    : offsetRaw != null && offsetRaw !== "" && Number.isFinite(Number(offsetRaw))
      ? Math.max(0, Math.floor(Number(offsetRaw)))
      : 0;

  try {
    const result = await fetchLogs(
      project,
      {
        ...awsCredentials,
        region: awsCredentials.region || project.aws.region || "us-east-1",
      },
      {
        callSid: callId,
        start: start ? Number(start) : undefined,
        end: end ? Number(end) : undefined,
        limit,
        offset,
        cursor: cursorRaw,
      },
    );
    return NextResponse.json({
      callSid: callId,
      projectId: project.id,
      ...result,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch CloudWatch logs";
    return apiError(message, 502, "CLOUDWATCH_ERROR");
  }
}
