import { NextRequest, NextResponse } from "next/server";
import { apiError, requireAuth, resolveProjectId, isAuthOk } from "@/lib/server/api";
import { getTwilioClientFromConfig } from "@/lib/server/twilio";
import { requireTwilioConfigForAwsAccount } from "@/lib/server/twilioEnv";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  const { id } = await ctx.params;
  const projectId = await resolveProjectId(request.nextUrl.searchParams);

  try {
    const twilioConfig = requireTwilioConfigForAwsAccount(auth.accountId);
    const client = getTwilioClientFromConfig(twilioConfig);
    const recordings = await client.recordings.list({ callSid: id, limit: 5 });
    if (!recordings.length) {
      return NextResponse.json({ recording: null, message: "No recording found for this call" });
    }

    const rec = recordings[0];
    const mediaUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioConfig.accountSid}/Recordings/${rec.sid}.mp3`;
    const proxy = request.nextUrl.searchParams.get("proxy") === "1";

    if (!proxy) {
      const projectParam = projectId ? `&projectId=${encodeURIComponent(projectId)}` : "";
      return NextResponse.json({
        recording: {
          sid: rec.sid,
          duration: rec.duration,
          status: rec.status,
          proxyUrl: `/api/calls/${id}/recording?proxy=1${projectParam}`,
          mediaUrl,
        },
      });
    }

    const authHeader = Buffer.from(`${twilioConfig.accountSid}:${twilioConfig.authToken}`).toString(
      "base64",
    );
    const upstream = await fetch(mediaUrl, { headers: { Authorization: `Basic ${authHeader}` } });
    if (!upstream.ok) {
      return apiError(`Failed to fetch recording (${upstream.status})`, 502, "RECORDING_ERROR");
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch recording";
    return apiError(message, 502, "RECORDING_ERROR");
  }
}
