import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/server/api";
import {
  getMappedProjectsForRole,
  mappingHasAccountRole,
} from "@/lib/server/twilioMappings";

type Body = {
  accountId?: string;
  roleName?: string;
};

/**
 * List projects under mappings["accountId:roleName"].projects (no Twilio secrets).
 * Does not apply JSON defaultProject — the client selects the first listed project.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const accountId = body.accountId?.trim();
  const roleName = body.roleName?.trim();

  if (!accountId || !roleName) {
    return apiError("accountId and roleName are required.", 400, "BAD_REQUEST");
  }

  if (!(await mappingHasAccountRole(accountId, roleName))) {
    return apiError(
      "No projects are mapped for this AWS account and role in twilio-mappings.json.",
      404,
      "NO_MAPPING",
    );
  }

  const projects = await getMappedProjectsForRole(accountId, roleName);

  return NextResponse.json({
    success: true,
    accountId,
    roleName,
    projects,
    source: "twilio-mappings",
  });
}
