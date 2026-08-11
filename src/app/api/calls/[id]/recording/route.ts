import { NextRequest, NextResponse } from "next/server";
import { apiError, requireAuth, isAuthOk } from "@/lib/server/api";
import { getTwilioClientFromConfig, twilioRestApiBase } from "@/lib/server/twilio";
import { isProjectTwilioOk, requireProjectTwilio } from "@/lib/server/projectTwilio";

type Ctx = { params: Promise<{ id: string }> };

function recordingMediaCandidates(
  apiBase: string,
  accountSid: string,
  recordingSid: string,
  uri?: string | null,
): string[] {
  const urls: string[] = [];
  // Prefer URI from Twilio when present (relative /2010-04-01/Accounts/.../Recordings/RExxx.json).
  if (uri) {
    const path = uri.replace(/\.json$/i, "");
    const absolute = path.startsWith("http") ? path.replace(/\.json$/i, "") : `${apiBase}${path}`;
    urls.push(`${absolute}.mp3`, `${absolute}.wav`);
  }
  urls.push(
    `${apiBase}/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}.mp3`,
    `${apiBase}/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}.wav`,
  );
  // Deduplicate while preserving order.
  return [...new Set(urls)];
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  const projectCtx = await requireProjectTwilio(auth, request.nextUrl.searchParams);
  if (!isProjectTwilioOk(projectCtx)) return projectCtx.response;

  const { id } = await ctx.params;
  const projectId = projectCtx.project.id;
  const twilioConfig = projectCtx.twilio;

  try {
    const client = getTwilioClientFromConfig(twilioConfig);
    const recordings = await client.recordings.list({ callSid: id, limit: 5 });
    if (!recordings.length) {
      return NextResponse.json({ recording: null, message: "No recording found for this call" });
    }

    const rec = recordings[0];
    const apiBase = twilioRestApiBase(twilioConfig);
    const candidates = recordingMediaCandidates(
      apiBase,
      twilioConfig.accountSid,
      rec.sid,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (rec as any).uri as string | undefined,
    );
    const mediaUrl = candidates[0];
    const proxy = request.nextUrl.searchParams.get("proxy") === "1";

    if (!proxy) {
      const qs = new URLSearchParams({ proxy: "1", projectId });
      return NextResponse.json({
        recording: {
          sid: rec.sid,
          duration: rec.duration,
          status: rec.status,
          // Authenticated same-origin proxy — use this in <audio>, not mediaUrl (needs Basic auth).
          proxyUrl: `/api/calls/${encodeURIComponent(id)}/recording?${qs.toString()}`,
          mediaUrl,
        },
      });
    }

    const authHeader = Buffer.from(`${twilioConfig.accountSid}:${twilioConfig.authToken}`).toString(
      "base64",
    );

    let upstream: Response | null = null;
    let usedUrl = mediaUrl;
    for (const url of candidates) {
      const res = await fetch(url, { headers: { Authorization: `Basic ${authHeader}` } });
      if (res.ok) {
        upstream = res;
        usedUrl = url;
        break;
      }
    }

    if (!upstream) {
      return apiError("Failed to fetch recording media from Twilio", 502, "RECORDING_ERROR");
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    const contentType = usedUrl.endsWith(".wav")
      ? "audio/wav"
      : upstream.headers.get("content-type") || "audio/mpeg";

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
        "Content-Length": String(buf.length),
        "Accept-Ranges": "bytes",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch recording";
    return apiError(message, 502, "RECORDING_ERROR");
  }
}
