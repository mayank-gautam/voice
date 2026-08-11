import { NextRequest, NextResponse } from "next/server";
import { apiError, requireAuth, isAuthOk } from "@/lib/server/api";
import { fetchVoiceInsightsSummary, mapInsightsToTelephony } from "@/lib/server/twilio";
import { isProjectTwilioOk, requireProjectTwilio } from "@/lib/server/projectTwilio";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  const projectCtx = await requireProjectTwilio(auth, request.nextUrl.searchParams);
  if (!isProjectTwilioOk(projectCtx)) return projectCtx.response;

  const { id } = await ctx.params;

  try {
    const summary = await fetchVoiceInsightsSummary(projectCtx.twilio, id);
    const mapped = mapInsightsToTelephony(summary);
    return NextResponse.json({ ...mapped, callSid: id, source: "twilio-insights" });
  } catch (e) {
    const err = e as Error & { status?: number; code?: string };
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
    const code = err.code || "INSIGHTS_ERROR";
    const message =
      err.message || "Failed to fetch telephony insights";
    return apiError(message, status, code);
  }
}
