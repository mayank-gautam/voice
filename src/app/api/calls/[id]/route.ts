import { NextRequest, NextResponse } from "next/server";
import { apiError, requireAuth, isAuthOk } from "@/lib/server/api";
import { getTwilioClientFromConfig, mapTwilioCall } from "@/lib/server/twilio";
import { requireTwilioConfigForAwsAccount } from "@/lib/server/twilioEnv";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  const { id } = await ctx.params;

  try {
    const twilioConfig = requireTwilioConfigForAwsAccount(auth.accountId);
    const client = getTwilioClientFromConfig(twilioConfig);
    const call = await client.calls(id).fetch();
    return NextResponse.json({ call: mapTwilioCall(call), source: "twilio" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Call not found";
    return apiError(message, 404, "NOT_FOUND");
  }
}
