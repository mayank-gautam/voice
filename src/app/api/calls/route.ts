import { NextRequest, NextResponse } from "next/server";
import { apiError, requireAuth, resolveProjectId, isAuthOk } from "@/lib/server/api";
import { getDecryptedActiveProject } from "@/lib/server/projectStore";
import { getTwilioClientFromConfig } from "@/lib/server/twilio";
import { requireTwilioConfigForAwsAccount } from "@/lib/server/twilioEnv";
import {
  DEFAULT_CALLS_LIMIT,
  MAX_CALLS_LIMIT,
  fetchCallsForPeriod,
} from "@/lib/server/twilioCalls";

function parseDateParam(value: string | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  const projectId = await resolveProjectId(request.nextUrl.searchParams);
  const project = await getDecryptedActiveProject(projectId, { accountId: auth.accountId, roleName: auth.roleName });
  if (!project) {
    return apiError("No project configured. Create one in Project Setup.", 400, "NO_PROJECT");
  }

  try {
    const twilioConfig = requireTwilioConfigForAwsAccount(auth.accountId);
    const client = getTwilioClientFromConfig(twilioConfig);
    const limit = Math.min(
      Number(request.nextUrl.searchParams.get("limit") || DEFAULT_CALLS_LIMIT),
      MAX_CALLS_LIMIT,
    );
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const startTimeAfter = parseDateParam(request.nextUrl.searchParams.get("startTimeAfter"));
    const startTimeBefore = parseDateParam(request.nextUrl.searchParams.get("startTimeBefore"));
    const includeActive = request.nextUrl.searchParams.get("includeActive") !== "0";

    const { items, truncated, activeMerged } = await fetchCallsForPeriod(client, {
      after: startTimeAfter,
      before: startTimeBefore,
      limit,
      status,
      includeActive,
    });

    const inbound = items.filter((c) => c.callType === "inbound").length;
    const outbound = items.filter((c) => c.callType === "outbound").length;
    const failed = items.filter((c) => c.status === "failed" || c.status === "dropped").length;

    return NextResponse.json({
      items,
      total: items.length,
      inbound,
      outbound,
      failed,
      active: activeMerged,
      truncated,
      source: "twilio",
      filter: {
        startTimeAfter: startTimeAfter?.toISOString() ?? null,
        startTimeBefore: startTimeBefore?.toISOString() ?? null,
        includeActive: includeActive && !status,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch Twilio calls";
    return apiError(message, 502, "TWILIO_ERROR");
  }
}
