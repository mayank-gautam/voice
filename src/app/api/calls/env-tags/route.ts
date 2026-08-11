import { NextRequest, NextResponse } from "next/server";
import { apiError, requireAuth, isAuthOk } from "@/lib/server/api";
import { getTwilioClientFromConfig } from "@/lib/server/twilio";
import { fetchEnvTagsForCallSids } from "@/lib/server/twilioCallEnv";
import { isProjectTwilioOk, requireProjectTwilio } from "@/lib/server/projectTwilio";

const MAX_SIDS = 40;

function parseSids(request: NextRequest, bodySids?: unknown): string[] {
  const fromQuery = request.nextUrl.searchParams.get("sids");
  const raw: string[] = [];
  if (Array.isArray(bodySids)) {
    for (const s of bodySids) if (typeof s === "string") raw.push(s);
  }
  if (fromQuery) {
    raw.push(...fromQuery.split(/[,]+/));
  }
  return [...new Set(raw.map((s) => s.trim()).filter(Boolean))].slice(0, MAX_SIDS);
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const sids =
    body && typeof body === "object" && body !== null && "sids" in body
      ? (body as { sids?: unknown }).sids
      : undefined;
  return handle(request, sids);
}

async function handle(request: NextRequest, bodySids?: unknown) {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  const sids = parseSids(request, bodySids);
  if (sids.length === 0) {
    return NextResponse.json({ tags: {}, source: "twilio" });
  }

  try {
    const ctx = await requireProjectTwilio(auth, request.nextUrl.searchParams);
    if (!isProjectTwilioOk(ctx)) return ctx.response;
    const client = getTwilioClientFromConfig(ctx.twilio);
    const tags = await fetchEnvTagsForCallSids(client, sids);
    return NextResponse.json({ tags, source: "twilio" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to resolve env tags";
    return apiError(message, 502, "TWILIO_ERROR");
  }
}
