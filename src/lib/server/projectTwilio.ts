import "server-only";

import { apiError, resolveProjectId, type RequireAuthResult } from "@/lib/server/api";
import { getDecryptedActiveProject, type ProjectConfig } from "@/lib/server/projectStore";
import { requireTwilioConfigForProject, type TwilioEnvConfig } from "@/lib/server/twilioEnv";
import { NextResponse } from "next/server";

export type AuthOk = Extract<RequireAuthResult, { ok: true }>;

export type ProjectTwilioContext = {
  project: ProjectConfig;
  twilio: TwilioEnvConfig;
};

/**
 * Resolve active hierarchy project + server-side Twilio for the session.
 * Never exposes Twilio auth tokens to the caller beyond this server context.
 */
export async function requireProjectTwilio(
  auth: AuthOk,
  searchParams?: URLSearchParams,
): Promise<ProjectTwilioContext | { response: NextResponse }> {
  const projectId = await resolveProjectId(searchParams);
  const project = await getDecryptedActiveProject(projectId, {
    accountId: auth.accountId,
    roleName: auth.roleName,
  });

  if (!project) {
    return {
      response: apiError(
        "No project configured for this AWS account/role in twilio-mappings.json.",
        400,
        "NO_PROJECT",
      ),
    };
  }

  try {
    const twilio = await requireTwilioConfigForProject(
      auth.accountId,
      project.id,
      auth.roleName,
    );
    return { project, twilio };
  } catch (error) {
    return {
      response: apiError(
        error instanceof Error
          ? error.message
          : "Twilio is not configured for this project in twilio-mappings.json.",
        400,
        "NO_TWILIO",
      ),
    };
  }
}

export function isProjectTwilioOk(
  value: ProjectTwilioContext | { response: NextResponse },
): value is ProjectTwilioContext {
  return "twilio" in value && "project" in value;
}
