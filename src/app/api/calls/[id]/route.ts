import { NextRequest, NextResponse } from "next/server";
import { apiError, requireAuth, isAuthOk } from "@/lib/server/api";
import { getTwilioClientFromConfig, mapTwilioCall } from "@/lib/server/twilio";
import { isProjectTwilioOk, requireProjectTwilio } from "@/lib/server/projectTwilio";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  const projectCtx = await requireProjectTwilio(auth, request.nextUrl.searchParams);
  if (!isProjectTwilioOk(projectCtx)) return projectCtx.response;

  const { id } = await ctx.params;

  try {
    const client = getTwilioClientFromConfig(projectCtx.twilio);
    const call = await client.calls(id).fetch();
    return NextResponse.json({ call: mapTwilioCall(call), source: "twilio" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Call not found";
    return apiError(message, 404, "NOT_FOUND");
  }
}
