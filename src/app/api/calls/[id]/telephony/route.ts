import { NextRequest, NextResponse } from "next/server";
import { apiError, requireAuth, isAuthOk } from "@/lib/server/api";
import { fetchVoiceInsightsSummary, mapInsightsToTelephony } from "@/lib/server/twilio";
import { requireTwilioConfigForAwsAccount } from "@/lib/server/twilioEnv";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  const { id } = await ctx.params;

  try {
    const twilioConfig = requireTwilioConfigForAwsAccount(auth.accountId);
    const summary = await fetchVoiceInsightsSummary(twilioConfig, id);
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
