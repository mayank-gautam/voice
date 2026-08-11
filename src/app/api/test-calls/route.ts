import { NextRequest, NextResponse } from "next/server";
import { apiError, requireAuth, isAuthOk } from "@/lib/server/api";
import { getTwilioClientFromConfig } from "@/lib/server/twilio";
import { isProjectTwilioOk, requireProjectTwilio } from "@/lib/server/projectTwilio";

const E164 = /^\+[1-9]\d{7,14}$/;
const MAX_TWIML_CHARS = 64_000;

function isValidTwiml(xml: string): boolean {
  const trimmed = xml.trim();
  if (!trimmed) return false;
  // Basic sanity: must look like a Twilio <Response> document
  return /<Response[\s>]/i.test(trimmed) && /<\/Response>/i.test(trimmed);
}

function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  const projectCtx = await requireProjectTwilio(auth, request.nextUrl.searchParams);
  if (!isProjectTwilioOk(projectCtx)) return projectCtx.response;
  const project = projectCtx.project;

  let body: {
    to?: string;
    from?: string;
    mode?: "twiml" | "webhook";
    twiml?: string;
    url?: string;
    timeout?: number;
    timeLimit?: number;
    record?: boolean;
    statusCallback?: string;
  };

  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400, "BAD_REQUEST");
  }

  const to = (body.to || "").trim();
  const from = (body.from || "").trim();
  const twiml = (body.twiml || "").trim();
  const webhookUrl = (body.url || "").trim();
  const mode =
    body.mode === "webhook" || (!twiml && webhookUrl)
      ? "webhook"
      : "twiml";

  if (!E164.test(to)) {
    return apiError("Invalid 'to' number. Use E.164 format, e.g. +14155550142", 400, "INVALID_TO");
  }
  if (!E164.test(from)) {
    return apiError("Invalid 'from' number. Use E.164 format, e.g. +14155550100", 400, "INVALID_FROM");
  }

  if (mode === "twiml") {
    if (!isValidTwiml(twiml)) {
      return apiError(
        "Invalid TwiML. Provide a complete <Response>...</Response> document.",
        400,
        "INVALID_TWIML"
      );
    }
    if (twiml.length > MAX_TWIML_CHARS) {
      return apiError(`TwiML exceeds ${MAX_TWIML_CHARS} characters`, 400, "TWIML_TOO_LARGE");
    }
  } else {
    if (!isValidWebhookUrl(webhookUrl)) {
      return apiError(
        "Invalid webhook URL. Provide an absolute http(s) URL Twilio can request for TwiML.",
        400,
        "INVALID_URL"
      );
    }
  }

  const timeout =
    body.timeout != null && Number.isFinite(Number(body.timeout))
      ? Math.min(Math.max(Math.floor(Number(body.timeout)), 1), 600)
      : undefined;
  const timeLimit =
    body.timeLimit != null && Number.isFinite(Number(body.timeLimit))
      ? Math.min(Math.max(Math.floor(Number(body.timeLimit)), 60), 14400)
      : undefined;
  const record = Boolean(body.record);
  const statusCallback =
    typeof body.statusCallback === "string" && body.statusCallback.trim().startsWith("https://")
      ? body.statusCallback.trim()
      : undefined;

  try {
    const client = getTwilioClientFromConfig(projectCtx.twilio);
    const call = await client.calls.create({
      to,
      from,
      ...(mode === "twiml"
        ? { twiml }
        : { url: webhookUrl, method: "POST" as const }),
      ...(timeout != null ? { timeout } : {}),
      ...(timeLimit != null ? { timeLimit } : {}),
      ...(record ? { record: true } : {}),
      ...(statusCallback
        ? {
            statusCallback,
            statusCallbackEvent: ["initiated", "ringing", "answered", "completed"] as const,
            statusCallbackMethod: "POST" as const,
          }
        : {}),
    });

    return NextResponse.json({
      call: {
        sid: call.sid,
        to: call.to,
        from: call.from,
        status: call.status,
        direction: call.direction,
        dateCreated: call.dateCreated?.toISOString?.() ?? null,
      },
      mode,
      source: "twilio",
      projectId: project.id,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create Twilio call";
    return apiError(message, 502, "TWILIO_ERROR");
  }
}
